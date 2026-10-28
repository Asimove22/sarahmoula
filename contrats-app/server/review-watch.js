// Veille de revue : à chaque événement du contrat, propose des mises à jour de la revue de contrat.
// Les règles métier tournent toujours ; l'IA (si activée) complète l'analyse. Rien n'est appliqué sans validation.
import { today } from './deadlines.js';
import { getSettings } from './db.js';
import { proposeReviewUpdates } from './ai.js';

const RISKS = ['faible', 'moyen', 'élevé', 'critique'];
const bump = (risk) => RISKS[Math.min(RISKS.indexOf(risk ?? 'faible') + 1, 3)];
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const money = (n, cur) => (n == null ? '' : `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('fr-FR')} ${cur || 'EUR'}`);

// Mots trop fréquents pour rapprocher un courrier d'un point de revue.
const STOP = new Set('les des une pour par avec dans sur aux est sont que qui vous nous votre notre cette ces son ses leur leurs plus pas tout tous sans entre afin dont mais ainsi comme lors suite selon objet monsieur madame courrier contrat marche travaux date bien'.split(' '));
// Thèmes liés au délai d'exécution (et non « délai de paiement » ou « délai de visa »).
const EXECUTION_DELAY = 'delai d.?execution|delai global|delai contractuel|achevement|planning|programme|calendrier|retard';
// Mots d'un courrier formel → thèmes de revue concernés.
const FORMAL_TOPICS = [
  [/penalit/, 'penalit'],
  [/resiliation/, 'resiliation'],
  [/mise en demeure/, 'resiliation|mise en demeure|penalit'],
  [/ordre de service|\bos\b/, 'ordre de service|modif|avenant'],
  [/reserve/, 'reserve|reception'],
  [/reclamation|forclusion|contentieux|differend/, 'reclam|differend|litige|forclusion'],
];
const words = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)));

/**
 * Décrit un événement à partir d'un enregistrement. Retourne null si l'événement n'intéresse pas la revue.
 * themes : expression régulière sur le thème / contenu des points de revue concernés.
 */
function describeEvent(table, row, action, before, contract) {
  const changed = (f) => action === 'création' || (before && before[f] !== row[f]);
  switch (table) {
    case 'amendments':
      if (row.status === 'signé' && changed('status'))
        return { label: `Avenant ${row.number} signé : ${row.title}`, detail: `Incidence ${money(row.amount, contract.currency)}${row.extra_days ? `, ${row.extra_days} j de délai` : ''}.`, themes: new RegExp(`(prix|modif|avenant|montant|revision|${EXECUTION_DELAY})`), newTheme: 'Modifications / avenants' };
      return null;
    case 'compensation_events':
      if (action === 'création') return { label: `${row.number} notifié : ${row.title}`, detail: row.description ?? '', themes: new RegExp(`(reclam|compensation|notification|forclusion|modif|${EXECUTION_DELAY})`), newTheme: 'Compensation Events' };
      if (changed('status') && ['implémenté', 'rejeté'].includes(row.status)) return { label: `${row.number} ${row.status} : ${row.title}`, detail: `Montant retenu ${money(row.assessed_amount ?? row.quoted_amount, contract.currency)}.`, themes: new RegExp(`(reclam|compensation|prix|litige|${EXECUTION_DELAY})`) };
      return null;
    case 'early_warnings':
      if (action === 'création') return { label: `${row.number} : ${row.title}`, detail: row.description ?? '', themes: row.affects_completion || row.affects_key_date ? new RegExp(`(penalit|early|${EXECUTION_DELAY})`) : /(early|prix)/ };
      return null;
    case 'correspondence': {
      if (action !== 'création') return null;
      const text = `${row.subject} ${row.summary ?? ''}`;
      // Seuls les thèmes réellement évoqués par le courrier sont visés.
      const topics = FORMAL_TOPICS.filter(([re]) => re.test(norm(text))).map(([, t]) => t);
      if (row.type === 'Mise en demeure') topics.push('resiliation|mise en demeure|penalit');
      const formal = topics.length > 0;
      return { label: `${row.direction === 'sortant' ? 'Courrier envoyé' : 'Courrier reçu'} ${row.reference ?? ''} : ${row.subject}`, detail: (row.summary ?? '').slice(0, 600), text, formal, themes: formal ? new RegExp(`(${topics.join('|')})`) : null };
    }
    case 'schedule_imports': {
      const end = contract.completion_date || contract.end_date;
      if (!row.planned_completion || !end || row.planned_completion <= end) return null;
      const days = Math.round((Date.parse(row.planned_completion) - Date.parse(end)) / 86400000);
      return { label: `Planning « ${row.name} » : achèvement prévu ${days} j après la date contractuelle`, detail: `Fin prévue ${row.planned_completion}, date contractuelle ${end}.`, themes: new RegExp(`(penalit|${EXECUTION_DELAY})`), raise: true, newTheme: 'Délais et pénalités' };
    }
    case 'service_orders':
      if (action === 'création')
        return { label: `Ordre de service ${row.number ?? ''} : ${row.title}`, detail: [row.kind, row.amount != null && `incidence ${money(row.amount, contract.currency)}`, row.extra_days && `${row.extra_days} j`].filter(Boolean).join(' · '), text: `${row.title} ${row.notes ?? ''}`, themes: new RegExp(`(ordre de service|modif|avenant|prix|${EXECUTION_DELAY})`), newTheme: 'Ordres de service' };
      return null;
    case 'claims':
      if (action === 'création') return { label: `Différend ${row.number ?? ''} : ${row.title}`, detail: row.notes ?? '', text: `${row.title} ${row.notes ?? ''}`, themes: /(reclam|differend|litige|forclusion)/, raise: true, newTheme: 'Différends et réclamations' };
      if (changed('status') && ['rejeté', 'contentieux'].includes(row.status)) return { label: `Réclamation ${row.number ?? ''} ${row.status} : ${row.title}`, detail: row.decision ?? '', themes: /(reclam|differend|litige)/, raise: true };
      return null;
    case 'submittals':
      if (changed('visa_status') && row.visa_status === 'refusé') return { label: `Visa refusé : ${row.number} ind. ${row.revision} – ${row.title}`, detail: row.comments ?? '', themes: /(visa|etudes|execution)/ };
      return null;
    case 'documents':
      if (['Avenant', 'CCAP', 'Contract Data', 'Contract Data / CCAP', 'Convention de groupement', 'CCTP', 'Acte d’engagement'].includes(row.category))
        return { label: `Nouvelle pièce contractuelle : ${row.title} (${row.category})`, detail: (row.content_text ?? '').slice(0, 1500), text: row.content_text ?? '', themes: null, document: true };
      return null;
    default:
      return null;
  }
}

export function createReviewWatch(db, { log = console } = {}) {
  const queue = [];
  let running = false;

  const pending = (contractId, itemId, entity, id) =>
    db.prepare("SELECT id FROM review_updates WHERE contract_id = ? AND status = 'proposée' AND IFNULL(review_item_id, 0) = ? AND trigger_entity = ? AND trigger_id = ?").get(contractId, itemId ?? 0, entity, id);

  function propose(contractId, { itemId = null, kind = 'mise à jour', entity, id, label, proposed, rationale, source }) {
    if (pending(contractId, itemId, entity, id)) return 0;
    db.prepare('INSERT INTO review_updates (contract_id, review_item_id, kind, trigger_entity, trigger_id, trigger_label, proposed, rationale, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      contractId, itemId, kind, entity, id, label, JSON.stringify(proposed), rationale ?? null, source,
    );
    return 1;
  }

  /** Règles déterministes : rapprochement par thème ou par mots communs / référence d'article. */
  function applyRules(contract, items, event, entity, id) {
    let n = 0;
    // L'intitulé de l'événement est conservé à part (trigger_label) : la note ne porte que le détail.
    const note = event.detail ? event.detail.slice(0, 300) : event.label;
    const matched = items.filter((it) => {
      const hay = norm(`${it.theme} ${it.content ?? ''} ${it.clause_ref ?? ''}`);
      if (event.themes && event.themes.test(hay)) return true;
      if (!event.text) return false;
      // Mention explicite de l'article du point de revue (ex. « article 4.3 »).
      const ref = String(it.clause_ref ?? '').match(/\d+(?:\.\d+)*/);
      if (ref && ref[0].length > 1 && new RegExp(`(art(icle)?|clause)\\.?\\s*${ref[0].replace(/\./g, '\\.')}\\b`, 'i').test(event.text)) return true;
      // Une pièce contractuelle partage des mots avec presque tous les points : on laisse l'IA en juger.
      if (event.document) return false;
      const common = [...words(`${it.theme} ${it.content ?? ''}`)].filter((w) => words(event.text).has(w));
      return common.length >= 2;
    });
    for (const it of matched.slice(0, 6)) {
      const proposed = { note };
      if ((event.raise || event.formal) && it.risk_level !== 'critique') proposed.risk_level = bump(it.risk_level);
      if (['accepté', 'analysé'].includes(it.status)) proposed.status = 'à analyser';
      n += propose(contract.id, { itemId: it.id, entity, id, label: event.label, proposed, rationale: proposed.risk_level ? 'Événement défavorable sur ce thème : niveau de risque à réévaluer.' : 'Événement lié à ce point : vérifier si l’analyse reste valable.', source: 'règle' });
    }
    if (!matched.length && event.newTheme) {
      n += propose(contract.id, { kind: 'nouveau point', entity, id, label: event.label, proposed: { theme: event.newTheme, content: `${event.label}. ${event.detail ?? ''}`.trim(), risk_level: event.raise ? 'élevé' : 'moyen', status: 'à analyser' }, rationale: 'Aucun point de la revue ne couvre cet événement.', source: 'règle' });
    }
    return n;
  }

  async function applyAi(contract, items, event, entity, id) {
    const settings = getSettings(db);
    if (settings.review_watch_ai === 'off') return 0;
    let out;
    try {
      out = await proposeReviewUpdates(db, contract, items, event);
    } catch (e) {
      // IA indisponible (Ollama arrêté, pas de clé…) : les règles suffisent, on ne bloque rien.
      log.warn?.(`Veille de revue IA ignorée : ${e.message}`);
      return 0;
    }
    let n = 0;
    const ids = new Set(items.map((i) => i.id));
    for (const u of out.updates ?? []) {
      if (!ids.has(u.review_item_id)) continue;
      // L'analyse de l'IA, plus fine, remplace la proposition de règle sur le même point et le même événement.
      db.prepare("DELETE FROM review_updates WHERE status = 'proposée' AND source = 'règle' AND review_item_id = ? AND trigger_entity = ? AND trigger_id = ?").run(u.review_item_id, entity, id);
      const proposed = { note: u.note };
      if (RISKS.includes(u.risk_level) && u.risk_level !== items.find((i) => i.id === u.review_item_id).risk_level) proposed.risk_level = u.risk_level;
      if (u.status && ['à analyser', 'analysé', 'à négocier', 'accepté'].includes(u.status)) proposed.status = u.status;
      if (u.mitigation) proposed.mitigation = u.mitigation;
      n += propose(contract.id, { itemId: u.review_item_id, entity: `${entity}:ia`, id, label: event.label, proposed, rationale: u.rationale, source: 'IA' });
    }
    for (const it of out.new_items ?? []) {
      n += propose(contract.id, { kind: 'nouveau point', entity: `${entity}:ia`, id, label: event.label, proposed: { theme: it.theme, clause_ref: it.clause_ref, content: it.content, risk_level: RISKS.includes(it.risk_level) ? it.risk_level : 'moyen', mitigation: it.mitigation, status: 'à analyser' }, rationale: it.rationale, source: 'IA' });
    }
    return n;
  }

  async function handle(job) {
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(job.contractId);
    if (!contract || ['clôturé', 'résilié', 'archivé'].includes(contract.status)) return;
    const items = db.prepare('SELECT id, theme, clause_ref, content, risk_level, status, mitigation FROM review_items WHERE contract_id = ?').all(contract.id);
    if (!items.length) return; // pas encore de revue : rien à mettre à jour
    const n = applyRules(contract, items, job.event, job.entity, job.id) + (job.ai ? await applyAi(contract, items, job.event, job.entity, job.id) : 0);
    if (n) db.prepare('INSERT INTO journal (contract_id, entity, entity_id, action, summary) VALUES (?, ?, ?, ?, ?)').run(contract.id, 'review_updates', null, 'veille', `${n} mise(s) à jour de revue proposée(s) suite à : ${job.event.label}`);
  }

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        try {
          await handle(queue.shift());
        } catch (e) {
          log.warn?.(`Veille de revue : ${e.message}`);
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    /** Appelé après chaque création / modification d'enregistrement. */
    notify(table, row, action, before) {
      if (!row?.contract_id) return;
      const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(row.contract_id);
      if (!contract) return;
      const event = describeEvent(table, row, action, before, contract);
      if (!event) return;
      queue.push({ contractId: contract.id, entity: table, id: row.id, event, ai: true });
      drain();
    },
    /** Réanalyse complète à la demande : les événements des 60 derniers jours, soumis à l'IA en une fois. */
    async reanalyze(contractId) {
      const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
      const items = db.prepare('SELECT id, theme, clause_ref, content, risk_level, status, mitigation FROM review_items WHERE contract_id = ?').all(contractId);
      if (!items.length) throw Object.assign(new Error('La revue est vide : chargez la check-list ou importez votre revue d’abord.'), { status: 400 });
      const recent = db
        .prepare("SELECT * FROM journal WHERE contract_id = ? AND entity NOT IN ('review_items', 'review_updates') AND at >= date('now', '-60 day') ORDER BY id DESC LIMIT 80")
        .all(contractId);
      const event = {
        label: `Réanalyse de la revue (${today()})`,
        detail: recent.map((j) => `${j.at.slice(0, 10)} · ${j.entity} · ${j.action} : ${j.summary}`).join('\n') || 'Aucun événement récent.',
      };
      return applyAi(contract, items, event, 'reanalyse', Date.now() % 1e9);
    },
    idle: async () => {
      while (running || queue.length) await new Promise((r) => setTimeout(r, 50));
    },
  };
}

/** Applique une proposition acceptée et trace l'historique du point. */
export function acceptUpdate(db, update) {
  const p = JSON.parse(update.proposed || '{}');
  const stamp = `${today()} · ${update.source === 'IA' ? 'IA' : 'règle'} · ${update.trigger_label ?? ''}`;
  if (update.kind === 'nouveau point') {
    const r = db.prepare('INSERT INTO review_items (contract_id, theme, clause_ref, content, risk_level, mitigation, status, source, history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      update.contract_id, p.theme ?? 'Nouveau point', p.clause_ref ?? null, p.content ?? null, p.risk_level ?? 'moyen', p.mitigation ?? null, p.status ?? 'à analyser', update.source === 'IA' ? 'IA' : 'veille', `[${stamp}] Point créé`,
    );
    return Number(r.lastInsertRowid);
  }
  const item = db.prepare('SELECT * FROM review_items WHERE id = ?').get(update.review_item_id);
  if (!item) throw Object.assign(new Error('Point de revue supprimé entre-temps'), { status: 404 });
  const changes = [];
  if (p.risk_level && p.risk_level !== item.risk_level) changes.push(`risque ${item.risk_level ?? '—'} → ${p.risk_level}`);
  if (p.status && p.status !== item.status) changes.push(`statut ${item.status} → ${p.status}`);
  const line = `[${stamp}] ${p.note ?? ''}${changes.length ? ` (${changes.join(', ')})` : ''}`;
  db.prepare("UPDATE review_items SET risk_level = ?, status = ?, mitigation = ?, history = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(
    p.risk_level ?? item.risk_level, p.status ?? item.status, p.mitigation ?? item.mitigation, [line, item.history].filter(Boolean).join('\n'), item.id,
  );
  return item.id;
}
