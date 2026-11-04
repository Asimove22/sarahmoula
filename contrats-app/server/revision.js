// Révision des prix : Cn = a + Σ bᵢ × (Iᵢ,n / Iᵢ,0), appliquée au montant de chaque situation.
// Les indices (BT, TP…) viennent de l'INSEE (série BDM, identifiant « idbank ») ou d'une saisie / import manuel.
import { logJournal } from './db.js';
import { today } from './deadlines.js';

const MONTHS = { janvier: 1, janv: 1, février: 2, fevrier: 2, févr: 2, fevr: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7, août: 8, aout: 8, septembre: 9, sept: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, décembre: 12, decembre: 12, déc: 12, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');

/** « septembre 2026 », « 09/2026 », « 2026-09 », date ISO → « 2026-09 ». */
export function parseMonth(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  let m = s.match(/(\d{4})-(\d{1,2})/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${pad(m[2])}`;
  m = s.match(/(?:^|\D)(\d{1,2})[/.-](\d{4})/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${pad(m[1])}`;
  m = s.match(/([a-zéûè]+)\.?\s+(\d{4})/);
  if (m && MONTHS[m[1]]) return `${m[2]}-${pad(MONTHS[m[1]])}`;
  if (raw instanceof Date) return raw.toISOString().slice(0, 7);
  return null;
}

export function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function parseTerms(raw) {
  try {
    const terms = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw ?? [];
    return terms.filter((x) => x?.index && Number.isFinite(Number(x.weight))).map((x) => ({ index: String(x.index).toUpperCase().trim(), weight: Number(x.weight) }));
  } catch {
    return [];
  }
}

function round(x, decimals, mode) {
  const f = 10 ** decimals;
  if (mode === 'supérieur') return Math.ceil(x * f - 1e-9) / f;
  if (mode === 'troncature') return Math.trunc(x * f + 1e-9) / f;
  return Math.round(x * f) / f;
}

/** Valeur d'un indice pour un mois ; à défaut, la dernière publiée avant (révision provisoire). */
function indexValue(db, code, month) {
  const exact = db.prepare('SELECT * FROM index_values WHERE code = ? AND month = ?').get(code, month);
  if (exact) return { ...exact, provisional: exact.status === 'provisoire' };
  const last = db.prepare('SELECT * FROM index_values WHERE code = ? AND month < ? ORDER BY month DESC LIMIT 1').get(code, month);
  return last ? { ...last, provisional: true, substitute: true } : null;
}

export const paymentMonth = (p) => parseMonth(p.period) ?? (p.submitted_date ? p.submitted_date.slice(0, 7) : null);

/** Coefficient et montant de révision d'une situation. */
export function computeRevision(db, p, c) {
  if (!c.rev_enabled) return null;
  const terms = parseTerms(c.rev_terms);
  const base = parseMonth(c.rev_base_month);
  const month = paymentMonth(p);
  const amount = p.amount_validated ?? p.amount_requested;
  if (!terms.length || !base) return { status: 'formule incomplète' };
  if (!month) return { status: 'mois inconnu' };
  const indexMonth = shiftMonth(month, -(c.rev_lag_months ?? 0));
  const details = [];
  let coef = c.rev_fixed ?? 0;
  let provisional = false;
  for (const term of terms) {
    const i0 = db.prepare('SELECT value FROM index_values WHERE code = ? AND month = ?').get(term.index, base)?.value;
    if (!i0) return { status: 'indice de base manquant', missing: `${term.index} ${base}`, month, index_month: indexMonth };
    const cur = indexValue(db, term.index, indexMonth);
    if (!cur) return { status: 'indice manquant', missing: `${term.index} ${indexMonth}`, month, index_month: indexMonth };
    provisional ||= cur.provisional;
    coef += term.weight * (cur.value / i0);
    details.push({ index: term.index, weight: term.weight, base_value: i0, value: cur.value, value_month: cur.month, substitute: Boolean(cur.substitute) });
  }
  const cn = round(coef, c.rev_decimals ?? 4, c.rev_rounding ?? 'arrondi');
  return {
    status: provisional ? 'provisoire' : 'définitive',
    month,
    index_month: indexMonth,
    coefficient: cn,
    basis: amount ?? null,
    amount: amount != null ? Math.round(amount * (cn - 1) * 100) / 100 : null,
    details,
  };
}

export function formulaCheck(c) {
  const terms = parseTerms(c.rev_terms);
  const sum = (c.rev_fixed ?? 0) + terms.reduce((s, t) => s + t.weight, 0);
  return { sum: Math.round(sum * 10000) / 10000, ok: Math.abs(sum - 1) < 0.0005, terms };
}

export function revisionSummary(db, c) {
  const payments = db.prepare('SELECT * FROM payments WHERE contract_id = ? ORDER BY submitted_date, id').all(c.id);
  const rows = payments.map((p) => ({ id: p.id, number: p.number, period: p.period, submitted_date: p.submitted_date, amount_requested: p.amount_requested, amount_validated: p.amount_validated, revision: computeRevision(db, p, c) }));
  const done = rows.filter((r) => r.revision?.amount != null);
  return {
    enabled: Boolean(c.rev_enabled),
    formula: { fixed: c.rev_fixed, terms: parseTerms(c.rev_terms), base_month: c.rev_base_month, lag_months: c.rev_lag_months ?? 0, decimals: c.rev_decimals ?? 4, rounding: c.rev_rounding ?? 'arrondi' },
    check: formulaCheck(c),
    rows,
    total: Math.round(done.reduce((s, r) => s + r.revision.amount, 0) * 100) / 100,
    provisional_total: Math.round(done.filter((r) => r.revision.status === 'provisoire').reduce((s, r) => s + r.revision.amount, 0) * 100) / 100,
  };
}

export function revisionInsights(db, c, { add }) {
  if (!c.rev_enabled) return;
  const check = formulaCheck(c);
  if (!check.terms.length || !c.rev_base_month) {
    add('attention', 'Formule de révision des prix incomplète', 'Renseignez la partie fixe, les indices et leurs pondérations, et le mois zéro (Finances → Révision des prix).', 'finances');
    return;
  }
  if (!check.ok) add('attention', `Formule de révision : la somme des coefficients vaut ${check.sum} au lieu de 1`, 'Vérifiez la partie fixe et les pondérations dans le CCAP.', 'finances');
  const s = revisionSummary(db, c);
  const missing = [...new Set(s.rows.map((r) => r.revision?.missing).filter(Boolean))];
  if (missing.length) add('attention', `Indices manquants pour la révision : ${missing.slice(0, 4).join(', ')}`, 'Mettez à jour les indices (bouton INSEE) ou saisissez-les dans Finances → Révision des prix.', 'finances');
  const prov = s.rows.filter((r) => r.revision?.status === 'provisoire');
  if (prov.length) add('info', `${prov.length} révision(s) provisoire(s) en attente de publication d’indices`, 'Calculées avec le dernier indice connu : elles deviendront définitives à la publication, automatiquement.', 'finances');
  // Indices publiés récemment qui rendent une révision définitive.
  const fresh = db.prepare("SELECT * FROM index_values WHERE fetched_at >= datetime('now', 'localtime', '-7 days')").all();
  for (const r of s.rows.filter((x) => x.revision?.status === 'définitive' && x.revision.details?.some((d) => fresh.some((f) => f.code === d.index && f.month === d.value_month))))
    add('info', `${r.number} : révision définitive calculée (Cn = ${r.revision.coefficient})`, `Nouvel indice publié : révision de ${r.revision.amount?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${c.currency || 'EUR'}. Intégrez-la à la prochaine situation.`, 'finances');
}

// ---------- Indices : saisie, import, INSEE ----------
export function upsertIndexValue(db, { code, month, value, status = 'définitif', source = 'manuel' }) {
  const m = parseMonth(month);
  const v = typeof value === 'string' ? Number(value.replace(/\s/g, '').replace(',', '.')) : Number(value);
  if (!m || !Number.isFinite(v) || v <= 0) return false;
  const prev = db.prepare('SELECT value, status FROM index_values WHERE code = ? AND month = ?').get(code, m);
  if (prev && prev.value === v && prev.status === status) return false;
  db.prepare(`INSERT INTO index_values (code, month, value, status, source, fetched_at) VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(code, month) DO UPDATE SET value = excluded.value, status = excluded.status, source = excluded.source, fetched_at = excluded.fetched_at`).run(code, m, v, status, source);
  return true;
}

export function ensureIndex(db, code, label) {
  db.prepare('INSERT OR IGNORE INTO price_indices (code, label) VALUES (?, ?)').run(code, label ?? code);
}

/** Observations d'une réponse SDMX de l'INSEE (StructureSpecificData ou GenericData). */
export function parseSdmx(xml) {
  const out = [];
  for (const m of xml.matchAll(/<(?:\w+:)?Obs\b([^>]*?)\/?>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w:]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    if (!attrs.TIME_PERIOD || attrs.OBS_VALUE === undefined || attrs.OBS_VALUE === '' || attrs.OBS_VALUE === 'NaN') continue;
    out.push({ month: attrs.TIME_PERIOD.slice(0, 7), value: Number(attrs.OBS_VALUE), status: /^(P|PROV)/i.test(attrs.OBS_QUAL ?? attrs.OBS_STATUS ?? '') ? 'provisoire' : 'définitif' });
  }
  return out.filter((o) => Number.isFinite(o.value));
}

const INSEE_URLS = [
  (id, start) => `https://api.insee.fr/series/BDM/data/SERIES_BDM/${id}?startPeriod=${start}`,
  (id, start) => `https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/${id}?startPeriod=${start}`,
  (id, start) => `https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/${id}?startPeriod=${start}`,
];

export async function fetchInsee(idbank, { start = '2015-01', apiKey, fetchImpl = fetch } = {}) {
  const errors = [];
  for (const url of INSEE_URLS) {
    try {
      const res = await fetchImpl(url(idbank, start), { headers: { Accept: 'application/xml', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        errors.push(`${res.status}`);
        continue;
      }
      const obs = parseSdmx(await res.text());
      if (obs.length) return obs;
      errors.push('réponse sans valeur');
    } catch (e) {
      errors.push(e.name === 'TimeoutError' ? 'délai dépassé' : e.message);
    }
  }
  throw new Error(`INSEE injoignable ou identifiant inconnu (${[...new Set(errors)].join(', ')})`);
}

/** Codes d'indices utilisés par une formule de révision active. */
export function usedIndexCodes(db) {
  const codes = new Set();
  for (const c of db.prepare("SELECT rev_terms FROM contracts WHERE rev_enabled = 1 AND status NOT IN ('clôturé','résilié','archivé')").all()) for (const t of parseTerms(c.rev_terms)) codes.add(t.index);
  return [...codes];
}

/**
 * Met à jour depuis l'INSEE les indices disposant d'un idbank (tous, ou ceux listés).
 * Journalise, pour chaque contrat concerné, les nouveaux indices publiés.
 */
export async function refreshIndices(db, { codes, apiKey, fetchImpl } = {}) {
  const list = db.prepare("SELECT * FROM price_indices WHERE idbank IS NOT NULL AND idbank != ''").all().filter((i) => (codes ? codes.includes(i.code) : i.auto));
  const result = [];
  for (const idx of list) {
    try {
      const obs = await fetchInsee(idx.idbank, { apiKey, fetchImpl });
      const added = obs.filter((o) => upsertIndexValue(db, { code: idx.code, month: o.month, value: o.value, status: o.status, source: 'INSEE' })).map((o) => o.month);
      db.prepare("UPDATE price_indices SET last_check = datetime('now','localtime'), last_error = NULL WHERE code = ?").run(idx.code);
      result.push({ code: idx.code, added, latest: obs.at(-1)?.month ?? null });
      if (added.length) {
        for (const c of db.prepare('SELECT id, rev_terms FROM contracts WHERE rev_enabled = 1').all().filter((c) => parseTerms(c.rev_terms).some((t) => t.index === idx.code)))
          logJournal(db, { contract_id: c.id, entity: 'contracts', entity_id: c.id, action: 'indice publié', summary: `${idx.code} : ${added.slice(-3).join(', ')} (INSEE) – révisions recalculées` });
      }
    } catch (e) {
      db.prepare("UPDATE price_indices SET last_check = datetime('now','localtime'), last_error = ? WHERE code = ?").run(e.message, idx.code);
      result.push({ code: idx.code, error: e.message });
    }
  }
  return result;
}

export function indexCatalog(db) {
  return db.prepare(`SELECT i.*, (SELECT month FROM index_values v WHERE v.code = i.code ORDER BY month DESC LIMIT 1) AS last_month,
      (SELECT value FROM index_values v WHERE v.code = i.code ORDER BY month DESC LIMIT 1) AS last_value,
      (SELECT COUNT(*) FROM index_values v WHERE v.code = i.code) AS values_count
    FROM price_indices i ORDER BY i.code`).all();
}

export const todayMonth = () => today().slice(0, 7);
