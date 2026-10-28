import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { columnsOf, toSql, logJournal, getSettings, setSettings } from './db.js';
import { computeDeadlines, today, addDays } from './deadlines.js';
import { buildIcs } from './ics.js';
import { parseEmail } from './mail.js';
import { createFileStore, safeName } from './files.js';
import { extractDocumentText, indexDocument, unindexDocument, ftsQuery } from './extract.js';
import { parseSchedule } from './schedule.js';
import { buildLetter, listTemplates, renderDocx, TEMPLATES } from './letters.js';
import { derive, extraDeadlines, financeSummary, computeInsights, reviewTemplateFor } from './rules.js';
import { AI_DEFAULTS, aiStatus, askContract, effectiveMode, draftLetter, reviewContract, startOllamaPull, testProvider, triageCorrespondence } from './ai.js';
import { createOcr, needsOcr } from './ocr.js';
import { createReviewWatch, acceptUpdate } from './review-watch.js';
import { KINDS, buildExport, buildTemplate, prepareImport } from './imports.js';
import { listBackups } from './backup.js';
import { BUYERS, CCAG, derivePublic, lateInterest, referential } from './legal.js';
import { localizeList, translate, wantsEnglish } from './i18n.js';

const LABELS = {
  contracts: 'contrat',
  early_warnings: 'early warning',
  compensation_events: 'compensation event',
  correspondence: 'courrier',
  milestones: 'jalon',
  documents: 'document',
  amendments: 'avenant',
  payments: 'situation',
  programmes: 'programme',
  submittals: 'visa',
  stakeholders: 'intervenant',
  group_members: 'membre du groupement',
  wbs_items: 'élément WBS',
  raci_items: 'activité RACI',
  communication_rules: 'règle de communication',
  review_items: 'point de revue',
  schedule_imports: 'planning importé',
  review_updates: 'mise à jour de revue',
  service_orders: 'ordre de service',
  claims: 'réclamation',
  subcontractors: 'sous-traitant',
};

// Ordre de lecture des pièces pour l'IA : les pièces contractuelles d'abord.
const AI_CATEGORY_ORDER = ['Contrat', 'Acte d’engagement', 'Contract Data', 'Contract Data / CCAP', 'CCAP', 'Avenant', 'Convention de groupement', 'CCAG Travaux', 'Scope / Works Information', 'CCTP', 'Annexe', 'BPU / DQE / DPGF'];
const NOT_FOR_REVIEW = ['Échange', 'Pièce jointe', 'Facture / Situation', 'Compte rendu / PV'];

// Colonnes de documents que l'utilisateur peut modifier (le fichier lui-même est immuable).
const DOCUMENT_EDITABLE = ['category', 'title', 'reference', 'doc_date', 'notes', 'correspondence_id', 'early_warning_id', 'compensation_event_id', 'submittal_id'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const APP_VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version;

const describe = (row) => row.title ?? row.subject ?? row.name ?? row.company ?? row.activity ?? row.theme ?? `#${row.id}`;

/** Prochain numéro de registre : EW-001, CE-002, ENT-003… */
function nextNumber(db, table, column, contractId, prefix) {
  const rows = db.prepare(`SELECT ${column} AS n FROM ${table} WHERE contract_id = ? AND ${column} LIKE ?`).all(contractId, `${prefix}-%`);
  const max = rows.reduce((m, r) => Math.max(m, Number.parseInt(String(r.n).slice(prefix.length + 1), 10) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function createApp({ db, dataDir, onShutdown }) {
  const app = express();
  const files = createFileStore(dataDir);
  const watch = createReviewWatch(db);
  const ocr = createOcr(db, dataDir, { onDocumentText: (doc) => watch.notify('documents', doc, 'création') });
  app.locals.ocr = ocr;
  app.locals.watch = watch;
  const ocrEnabled = () => getSettings(db).ocr_mode !== 'off';
  // Les registres de la revue elle-même ne déclenchent pas la veille.
  const notify = (table, row, action, before) => {
    if (!['review_items', 'review_updates', 'documents'].includes(table)) watch.notify(table, row, action, before);
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 },
    // Les navigateurs envoient les noms de fichiers en UTF-8 (accents, tirets longs…).
    defParamCharset: 'utf8',
  });
  const columns = Object.fromEntries(Object.keys(LABELS).map((t) => [t, columnsOf(db, t)]));

  app.use(express.json({ limit: '5mb' }));

  const getRow = (table, id) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id));
    if (!row) throw new HttpError(404, `${LABELS[table]} introuvable`);
    return row;
  };
  const contractOf = (row, table) => (table === 'contracts' ? row.id : row.contract_id);

  function insert(table, body) {
    const cols = columns[table].filter((c) => c in body && c !== 'updated_at');
    if (table !== 'contracts' && !body.contract_id) throw new HttpError(400, 'contract_id manquant');
    const result = db
      .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...cols.map((c) => toSql(body[c])));
    const row = getRow(table, result.lastInsertRowid);
    logJournal(db, { contract_id: contractOf(row, table), entity: table, entity_id: row.id, action: 'création', summary: describe(row) });
    notify(table, row, 'création');
    return row;
  }

  function update(table, id, body, allowed = columns[table]) {
    const before = getRow(table, id);
    const cols = allowed.filter((c) => c in body && !['contract_id', 'updated_at'].includes(c));
    if (cols.length) {
      db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(...cols.map((c) => toSql(body[c])), Number(id));
    }
    const row = getRow(table, id);
    const changed = cols.filter((c) => String(before[c] ?? '') !== String(row[c] ?? ''));
    if (changed.length) {
      const detail = changed.includes('status') ? ` – statut : ${before.status} → ${row.status}` : '';
      logJournal(db, { contract_id: contractOf(row, table), entity: table, entity_id: row.id, action: 'modification', summary: `${describe(row)}${detail}` });
      notify(table, row, 'modification', before);
    }
    return row;
  }

  function remove(table, id) {
    const row = getRow(table, id);
    if (table === 'contracts') {
      for (const doc of db.prepare('SELECT * FROM documents WHERE contract_id = ?').all(row.id)) files.trash(doc);
    }
    if (table === 'documents') {
      files.trash(row);
      if (row.is_current) {
        // La version précédente redevient la version courante.
        const prev = db.prepare('SELECT id FROM documents WHERE family_id = ? AND id != ? ORDER BY version DESC LIMIT 1').get(row.family_id, row.id);
        if (prev) db.prepare('UPDATE documents SET is_current = 1 WHERE id = ?').run(prev.id);
      }
    }
    if (table === 'documents') unindexDocument(db, row.id);
    if (table === 'contracts') {
      for (const d of db.prepare('SELECT id FROM documents WHERE contract_id = ?').all(row.id)) unindexDocument(db, d.id);
    }
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
    logJournal(db, { contract_id: table === 'contracts' ? null : row.contract_id, entity: table, entity_id: row.id, action: 'suppression', summary: describe(row) });
  }

  const h = (fn) => async (req, res, next) => {
    try {
      const out = await fn(req, res);
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (e) {
      next(e);
    }
  };

  // ---------- Contrats ----------
  app.get('/api/contracts', h(() =>
    db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM documents d WHERE d.contract_id = c.id AND d.is_current = 1) AS documents_count,
        (SELECT COUNT(*) FROM early_warnings e WHERE e.contract_id = c.id AND e.status = 'ouvert') AS open_ew_count,
        (SELECT COUNT(*) FROM compensation_events ce WHERE ce.contract_id = c.id AND ce.status NOT IN ('implémenté','rejeté','retiré')) AS open_ce_count,
        (SELECT COUNT(*) FROM correspondence m WHERE m.contract_id = c.id AND m.response_required = 1 AND m.response_date IS NULL) AS pending_replies_count
      FROM contracts c ORDER BY c.status = 'actif' DESC, c.updated_at DESC, c.id DESC`).all()));
  // ai_effective : moteur réellement utilisé pour ce contrat (réglage du contrat, sinon sélecteur global).
  app.get('/api/contracts/:id', h((req) => {
    const c = getRow('contracts', req.params.id);
    return { ...c, ai_effective: effectiveMode(db, c) };
  }));
  app.post('/api/contracts', h((req) => {
    if (!req.body.title) throw new HttpError(400, 'Le titre du contrat est obligatoire');
    return insert('contracts', req.body);
  }));
  app.put('/api/contracts/:id', h((req) => update('contracts', req.params.id, req.body)));
  app.delete('/api/contracts/:id', h((req) => (remove('contracts', req.params.id), { ok: true })));

  // ---------- Registres rattachés à un contrat ----------
  const registers = {
    early_warnings: { prefix: () => 'EW', numberCol: 'number', order: 't.number DESC' },
    compensation_events: { prefix: () => 'CE', numberCol: 'number', order: 't.number DESC' },
    correspondence: { prefix: (b) => (b.direction === 'sortant' ? 'SOR' : 'ENT'), numberCol: 'reference', order: 't.date DESC, t.id DESC' },
    milestones: { order: 'COALESCE(t.actual_date, t.forecast_date, t.planned_date) ASC' },
    amendments: { prefix: () => 'AV', numberCol: 'number', order: 't.number ASC' },
    payments: { prefix: () => 'SIT', numberCol: 'number', order: 't.number DESC' },
    programmes: { prefix: () => 'PRG', numberCol: 'number', order: 't.number DESC' },
    submittals: { prefix: () => 'VIS', numberCol: 'number', order: 't.number ASC, t.revision ASC' },
    stakeholders: { order: 't.organisation, t.name' },
    group_members: { order: "t.role = 'mandataire' DESC, t.share_percent DESC" },
    wbs_items: { order: 't.code' },
    raci_items: { order: 't.wbs_code, t.id' },
    communication_rules: { order: 't.id' },
    review_items: { order: "CASE t.risk_level WHEN 'critique' THEN 0 WHEN 'élevé' THEN 1 WHEN 'moyen' THEN 2 ELSE 3 END, t.id" },
    schedule_imports: { order: 't.id DESC' },
    service_orders: { prefix: () => 'OS', numberCol: 'number', order: 't.number DESC' },
    claims: { prefix: () => 'REC', numberCol: 'number', order: 't.number DESC' },
    subcontractors: { order: 't.company' },
  };

  const enrich = (table, rows) => {
    if (!['compensation_events', 'payments', 'submittals', 'programmes', 'service_orders', 'claims', 'subcontractors'].includes(table)) return rows;
    const contracts = new Map();
    const ecbRate = table === 'payments' ? getSettings(db).ecb_rate : null;
    return rows.map((r) => {
      if (!contracts.has(r.contract_id)) contracts.set(r.contract_id, getRow('contracts', r.contract_id));
      const c = contracts.get(r.contract_id);
      const row = derivePublic(table, derive(table, r, c), c);
      // Marchés publics : intérêts moratoires d'une situation payée en retard ou toujours impayée.
      if (table === 'payments' && c.framework === 'FR_PUBLIC') {
        row.late_interest = lateInterest({ amount: row.amount_validated ?? row.amount_requested, dueDate: row.computed_due_date, paidDate: row.paid_date, ecbRate });
      }
      return row;
    });
  };

  /** Enregistre un fichier, extrait son texte et l'indexe pour la recherche et l'IA. */
  async function storeDocument(args) {
    const doc = files.save(db, args);
    const { text, status } = await extractDocumentText(doc.original_name, args.buffer);
    db.prepare('UPDATE documents SET content_text = ?, text_status = ? WHERE id = ?').run(text || null, status, doc.id);
    indexDocument(db, doc, text);
    const stored = { ...doc, content_text: text, text_status: status };
    // Scan ou photo : le texte arrivera plus tard, par l'OCR en tâche de fond.
    if (needsOcr(stored) && ocrEnabled()) {
      ocr.enqueue(doc.id);
      return { ...stored, text_status: 'ocr en attente' };
    }
    watch.notify('documents', stored, 'création');
    return stored;
  }
  const stripText = ({ content_text: _ignored, ...rest }) => rest;

  /** Toutes les échéances (V1 + V2), triées. */
  function allDeadlines(contractId) {
    const contracts = contractId ? [getRow('contracts', contractId)] : db.prepare('SELECT * FROM contracts').all();
    const now = today();
    return [...computeDeadlines(db, { contractId }), ...extraDeadlines(db, contracts).map((d) => ({ ...d, overdue: d.date < now }))]
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  for (const [table, cfg] of Object.entries(registers)) {
    app.get(`/api/${table}`, h((req) => {
      const filters = [];
      const args = [];
      if (req.query.contract_id) { filters.push('t.contract_id = ?'); args.push(Number(req.query.contract_id)); }
      if (req.query.status && columns[table].includes('status')) { filters.push('t.status = ?'); args.push(String(req.query.status)); }
      const docLink = { correspondence: 'correspondence_id', early_warnings: 'early_warning_id', compensation_events: 'compensation_event_id', submittals: 'submittal_id' }[table];
      const extra = docLink ? `, (SELECT COUNT(*) FROM documents d WHERE d.${docLink} = t.id) AS documents_count` : '';
      const rows = db.prepare(`
        SELECT t.*, c.title AS contract_title, c.reference AS contract_reference ${extra}
        FROM ${table} t JOIN contracts c ON c.id = t.contract_id
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY ${cfg.order}`).all(...args);
      return enrich(table, rows);
    }));
    app.get(`/api/${table}/:id`, h((req) => enrich(table, [getRow(table, req.params.id)])[0]));
    app.post(`/api/${table}`, h((req) => {
      const body = { ...req.body };
      getRow('contracts', body.contract_id);
      if (cfg.numberCol && !body[cfg.numberCol]) {
        body[cfg.numberCol] = nextNumber(db, table, cfg.numberCol, Number(body.contract_id), cfg.prefix(body));
      }
      return enrich(table, [insert(table, body)])[0];
    }));
    app.put(`/api/${table}/:id`, h((req) => enrich(table, [update(table, req.params.id, req.body)])[0]));
    app.delete(`/api/${table}/:id`, h((req) => (remove(table, req.params.id), { ok: true })));
  }

  // ---------- Documents (GED) ----------
  app.get('/api/documents', h((req) => {
    const filters = [];
    const args = [];
    for (const key of ['contract_id', 'correspondence_id', 'early_warning_id', 'compensation_event_id', 'submittal_id']) {
      if (req.query[key]) { filters.push(`d.${key} = ?`); args.push(Number(req.query[key])); }
    }
    if (req.query.category) { filters.push('d.category = ?'); args.push(String(req.query.category)); }
    if (!req.query.all_versions) filters.push('d.is_current = 1');
    return db.prepare(`
      SELECT d.*, c.title AS contract_title,
        (SELECT COUNT(*) FROM documents v WHERE v.family_id = d.family_id) AS versions_count
      FROM documents d JOIN contracts c ON c.id = d.contract_id
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY COALESCE(d.doc_date, substr(d.created_at, 1, 10)) DESC, d.id DESC`).all(...args).map(stripText);
  }));
  app.get('/api/documents/:id/versions', h((req) => {
    const doc = getRow('documents', req.params.id);
    return db.prepare('SELECT * FROM documents WHERE family_id = ? ORDER BY version DESC').all(doc.family_id ?? doc.id).map(stripText);
  }));
  app.get('/api/documents/:id/file', h((req, res) => {
    const doc = getRow('documents', req.params.id);
    const file = files.absolutePath(doc);
    if (!fs.existsSync(file)) throw new HttpError(404, 'Fichier absent du disque');
    res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
    const disposition = req.query.download ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
    res.sendFile(file);
  }));
  app.post('/api/documents/upload', upload.array('files'), h(async (req) => {
    const { contract_id: contractId, ...meta } = req.body;
    getRow('contracts', contractId);
    if (!req.files?.length) throw new HttpError(400, 'Aucun fichier reçu');
    if (meta.parent_id && req.files.length > 1) throw new HttpError(400, 'Une nouvelle version ne peut contenir qu’un seul fichier');
    const saved = [];
    for (const f of req.files) {
      saved.push(stripText(await storeDocument({
        contractId,
        buffer: f.buffer,
        filename: f.originalname,
        mime: f.mimetype,
        meta: req.files.length > 1 ? { ...meta, title: '' } : meta,
      })));
    }
    return saved;
  }));
  app.put('/api/documents/:id', h((req) => {
    const row = update('documents', req.params.id, req.body, DOCUMENT_EDITABLE);
    indexDocument(db, row, row.content_text);
    return stripText(row);
  }));
  app.delete('/api/documents/:id', h((req) => (remove('documents', req.params.id), { ok: true })));

  // ---------- Import d'échanges par glisser-déposer (.eml, .msg, PDF…) ----------
  app.post('/api/correspondence/import', upload.array('files'), h(async (req) => {
    const contractId = Number(req.body.contract_id);
    getRow('contracts', contractId);
    const direction = req.body.direction === 'sortant' ? 'sortant' : 'entrant';
    const created = [];
    for (const f of req.files ?? []) {
      const filename = f.originalname;
      let email = null;
      try {
        email = await parseEmail(filename, f.buffer);
      } catch (e) {
        console.warn(`Impossible de lire l'email ${filename} :`, e.message);
      }
      const record = {
        contract_id: contractId,
        direction,
        type: email ? 'Email' : 'Courrier',
        subject: email?.subject || filename.replace(/\.[^.]+$/, ''),
        sender: email?.sender ?? null,
        recipient: email?.recipient ?? null,
        date: email?.date || today(),
        summary: email?.body ? email.body.slice(0, 4000) : null,
        status: direction === 'entrant' ? 'à traiter' : 'envoyé',
      };
      record.reference = nextNumber(db, 'correspondence', 'reference', contractId, direction === 'sortant' ? 'SOR' : 'ENT');
      const row = insert('correspondence', record);
      const docMeta = { correspondence_id: row.id, doc_date: record.date };
      await storeDocument({ contractId, buffer: f.buffer, filename, mime: f.mimetype, meta: { ...docMeta, category: 'Échange', title: record.subject } });
      for (const att of email?.attachments ?? []) {
        await storeDocument({ contractId, buffer: att.content, filename: att.filename, mime: att.mime, meta: { ...docMeta, category: 'Pièce jointe' } });
      }
      created.push({ ...row, attachments: email?.attachments.length ?? 0 });
    }
    return created;
  }));

  // ---------- Échéances, tableau de bord, calendrier ----------
  app.get('/api/deadlines', h((req) => localizeList(allDeadlines(req.query.contract_id), wantsEnglish(req))));

  app.get('/api/dashboard', h((req) => {
    const en = wantsEnglish(req);
    const deadlines = localizeList(allDeadlines(), en);
    const horizon30 = addDays(today(), 30);
    const count = (sql) => db.prepare(sql).get().n;
    return {
      stats: {
        active_contracts: count("SELECT COUNT(*) AS n FROM contracts WHERE status = 'actif'"),
        open_early_warnings: count("SELECT COUNT(*) AS n FROM early_warnings WHERE status = 'ouvert'"),
        open_compensation_events: count("SELECT COUNT(*) AS n FROM compensation_events WHERE status NOT IN ('implémenté','rejeté','retiré')"),
        pending_replies: count('SELECT COUNT(*) AS n FROM correspondence WHERE response_required = 1 AND response_date IS NULL'),
        documents: count('SELECT COUNT(*) AS n FROM documents WHERE is_current = 1'),
        overdue: deadlines.filter((d) => d.overdue).length,
        pending_visas: count("SELECT COUNT(*) AS n FROM submittals WHERE visa_status = 'en attente'"),
      },
      insights: localizeList(computeInsights(db), en),
      overdue: deadlines.filter((d) => d.overdue),
      upcoming: deadlines.filter((d) => !d.overdue && d.date <= horizon30),
      recent_activity: db.prepare(`
        SELECT j.*, c.title AS contract_title FROM journal j LEFT JOIN contracts c ON c.id = j.contract_id
        ORDER BY j.id DESC LIMIT 15`).all(),
    };
  }));

  // ---------- KPI & graphiques ----------
  app.get('/api/kpis', h((req) => {
    const cid = req.query.contract_id ? Number(req.query.contract_id) : null;
    const contracts = cid ? [getRow('contracts', cid)] : db.prepare("SELECT * FROM contracts WHERE status != 'archivé' ORDER BY title").all();
    const ids = contracts.map((c) => c.id);
    const scoped = (sql, ...args) => (ids.length ? db.prepare(`${sql} AND contract_id IN (${ids.map(() => '?').join(',')})`).all(...args, ...ids) : []);
    const now = today();

    const finance = contracts.map((c) => {
      const f = financeSummary(db, c);
      return { id: c.id, title: c.title, reference: c.reference, currency: f.currency, current: f.current, paid: f.paid,
        outstanding: f.outstanding, remaining: Math.max(0, f.remaining_to_invoice), variation_percent: f.variation_percent, progress_percent: f.progress_percent };
    }).filter((f) => f.current > 0);

    // Revue de contrat : points par thème et niveau de risque (8 thèmes principaux, le reste regroupé).
    const LEVELS = ['faible', 'moyen', 'élevé', 'critique'];
    const byTheme = new Map();
    for (const r of scoped("SELECT theme, risk_level FROM review_items WHERE status != 'clos'")) {
      const row = byTheme.get(r.theme) ?? { theme: r.theme, faible: 0, moyen: 0, élevé: 0, critique: 0, non_évalué: 0, total: 0 };
      row[LEVELS.includes(r.risk_level) ? r.risk_level : 'non_évalué'] += 1;
      row.total += 1;
      byTheme.set(r.theme, row);
    }
    let risks = [...byTheme.values()].sort((a, b) => b.critique - a.critique || b.élevé - a.élevé || b.total - a.total);
    if (risks.length > 8) {
      const other = { theme: wantsEnglish(req) ? translate('Autres thèmes') : 'Autres thèmes', faible: 0, moyen: 0, élevé: 0, critique: 0, non_évalué: 0, total: 0 };
      for (const r of risks.slice(7)) for (const k of Object.keys(other)) if (k !== 'theme') other[k] += r[k];
      risks = [...risks.slice(0, 7), other];
    }

    // EW / CE notifiés par mois sur 12 mois glissants.
    const months = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(`${now.slice(0, 7)}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    const countBy = (rows) => months.map((m) => rows.filter((r) => r.d?.startsWith(m)).length);
    const ew = countBy(scoped('SELECT COALESCE(date_notified, substr(created_at, 1, 10)) AS d FROM early_warnings WHERE 1 = 1'));
    const ce = countBy(scoped('SELECT COALESCE(date_notified, date_aware, substr(created_at, 1, 10)) AS d FROM compensation_events WHERE 1 = 1'));
    const monthly = months.map((month, i) => ({ month, ew: ew[i], ce: ce[i] }));

    // Échéances : en retard + 6 prochains mois.
    const deadlines = allDeadlines(cid);
    const nextMonths = months.slice(-1).concat([1, 2, 3, 4, 5].map((n) => {
      const d = new Date(`${now.slice(0, 7)}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + n);
      return d.toISOString().slice(0, 7);
    }));
    const deadlineMonths = [
      { month: 'overdue', count: deadlines.filter((d) => d.overdue).length },
      ...nextMonths.map((m) => ({ month: m, count: deadlines.filter((d) => !d.overdue && d.date.startsWith(m)).length })),
    ];

    const VISAS = ['en attente', 'VSO', 'VAO', 'refusé', 'sans objet'];
    const visaRows = scoped('SELECT visa_status, visa_due, visa_date FROM submittals WHERE 1 = 1');
    const visas = VISAS.map((status) => ({ status, count: visaRows.filter((v) => v.visa_status === status).length }));
    const visaLate = visaRows.filter((v) => v.visa_status === 'en attente' && v.visa_due && v.visa_due < now).length;

    // Planning : glissement de la fin prévue (dernier planning importé) par rapport à la date contractuelle.
    const schedule = contracts.map((c) => {
      const imp = db.prepare('SELECT planned_completion FROM schedule_imports WHERE contract_id = ? ORDER BY id DESC LIMIT 1').get(c.id);
      const end = c.completion_date || c.end_date;
      if (!imp?.planned_completion || !end) return null;
      return { id: c.id, title: c.title, contract_end: end, planned_completion: imp.planned_completion,
        slip_days: Math.round((Date.parse(imp.planned_completion) - Date.parse(end)) / 86400000) };
    }).filter(Boolean);

    const ces = scoped("SELECT quoted_amount FROM compensation_events WHERE status NOT IN ('implémenté','rejeté','retiré')");
    return {
      months,
      tiles: {
        active_contracts: contracts.filter((c) => c.status === 'actif').length,
        open_ew: scoped("SELECT id FROM early_warnings WHERE status = 'ouvert'").length,
        open_ce: ces.length,
        ce_exposure: ces.reduce((s, c) => s + (c.quoted_amount ?? 0), 0),
        high_risks: risks.reduce((s, r) => s + r.élevé + r.critique, 0),
        overdue: deadlineMonths[0].count,
        pending_visas: visas[0].count,
        late_visas: visaLate,
        claims_open: scoped("SELECT id FROM claims WHERE status NOT IN ('accepté','partiellement accepté','clos','abandonné')").length,
      },
      finance, risks, monthly, deadlines: deadlineMonths, visas, schedule,
    };
  }));

  app.get('/api/calendar.ics', h((req, res) => {
    const deadlines = allDeadlines(req.query.contract_id).filter((d) => !d.overdue);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="echeances-contrats.ics"');
    res.send(buildIcs(deadlines));
  }));

  app.get('/api/journal', h((req) => {
    const where = req.query.contract_id ? 'WHERE contract_id = ?' : '';
    const args = req.query.contract_id ? [Number(req.query.contract_id)] : [];
    return db.prepare(`SELECT * FROM journal ${where} ORDER BY id DESC LIMIT 300`).all(...args);
  }));

  // ---------- Recherche globale ----------
  app.get('/api/search', h((req) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return [];
    const like = `%${q}%`;
    const run = (kind, sql, n) => db.prepare(sql).all(...Array(n).fill(like)).map((r) => ({ kind, ...r }));
    return [
      ...run('contracts', `SELECT id, id AS contract_id, title, reference AS subtitle FROM contracts
        WHERE title LIKE ? OR reference LIKE ? OR counterparty LIKE ? OR project LIKE ? OR notes LIKE ? LIMIT 30`, 5),
      ...searchDocuments(q, like),
      ...run('correspondence', `SELECT id, contract_id, subject AS title, COALESCE(reference, '') || ' · ' || COALESCE(sender, '') AS subtitle FROM correspondence
        WHERE subject LIKE ? OR reference LIKE ? OR sender LIKE ? OR recipient LIKE ? OR summary LIKE ? LIMIT 50`, 5),
      ...run('early_warnings', `SELECT id, contract_id, title, number AS subtitle FROM early_warnings
        WHERE title LIKE ? OR number LIKE ? OR description LIKE ? OR actions LIKE ? LIMIT 30`, 4),
      ...run('compensation_events', `SELECT id, contract_id, title, number AS subtitle FROM compensation_events
        WHERE title LIKE ? OR number LIKE ? OR description LIKE ? OR clause LIKE ? LIMIT 30`, 4),
      ...run('review_items', `SELECT id, contract_id, theme AS title, COALESCE(clause_ref, '') || ' · ' || COALESCE(content, '') AS subtitle FROM review_items
        WHERE theme LIKE ? OR clause_ref LIKE ? OR content LIKE ? LIMIT 30`, 3),
      ...run('submittals', `SELECT id, contract_id, title, number || ' ind. ' || COALESCE(revision, '') AS subtitle FROM submittals
        WHERE title LIKE ? OR number LIKE ? OR discipline LIKE ? LIMIT 30`, 3),
    ];
  }));

  /** Recherche plein texte dans le contenu des documents (insensible aux accents), puis dans les noms de fichiers. */
  function searchDocuments(q, like) {
    const found = new Map();
    const match = ftsQuery(q);
    if (match) {
      const rows = db.prepare(`
        SELECT d.id, d.contract_id, d.title, d.category, snippet(documents_fts, 1, '⟦', '⟧', '…', 14) AS excerpt
        FROM documents_fts JOIN documents d ON d.id = documents_fts.rowid
        WHERE documents_fts MATCH ? AND d.is_current = 1 ORDER BY bm25(documents_fts) LIMIT 50`).all(match);
      for (const r of rows) found.set(r.id, { kind: 'documents', id: r.id, contract_id: r.contract_id, title: r.title, subtitle: r.category, excerpt: r.excerpt });
    }
    for (const r of db.prepare(`SELECT d.id, d.contract_id, d.title, d.category || ' · ' || d.original_name AS subtitle FROM documents d
        WHERE d.is_current = 1 AND (d.original_name LIKE ? OR d.reference LIKE ? OR d.notes LIKE ?) LIMIT 30`).all(like, like, like)) {
      if (!found.has(r.id)) found.set(r.id, { kind: 'documents', ...r });
    }
    return [...found.values()];
  }

  // ---------- Exports CSV (ouvrables dans Excel) ----------
  app.get('/api/export/:table.csv', h((req, res) => {
    const table = req.params.table;
    if (!LABELS[table]) throw new HttpError(404, 'Registre inconnu');
    const where = req.query.contract_id && table !== 'contracts' ? 'WHERE t.contract_id = ?' : '';
    const args = where ? [Number(req.query.contract_id)] : [];
    let rows = db.prepare(`SELECT t.* FROM ${table} t ${where} ORDER BY t.id`).all(...args);
    rows = enrich(table, rows).map(stripText);
    const cols = rows.length ? Object.keys(rows[0]) : ['id', ...columns[table]];
    const cell = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => cell(r[c])).join(';'))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${table}-${today()}.csv"`);
    res.send(`\uFEFF${csv}`);
  }));

  // ================= V2 =================

  // ---------- Marchés publics : référentiel applicable ----------
  app.get('/api/legal/options', h(() => ({
    ccag: Object.entries(CCAG).map(([value, v]) => ({ value, label: v.label })),
    buyers: Object.entries(BUYERS).map(([value, v]) => ({ value, label: v.label, payment_days: v.paymentDays })),
  })));
  app.get('/api/contracts/:id/legal', h((req) => referential(getRow('contracts', req.params.id), getSettings(db))));

  // ---------- Points d'attention, finances ----------
  app.get('/api/insights', h((req) => localizeList(computeInsights(db, { contractId: req.query.contract_id }), wantsEnglish(req))));
  app.get('/api/contracts/:id/finance', h((req) => financeSummary(db, getRow('contracts', req.params.id))));

  // ---------- Revue de contrat : check-list type ----------
  app.post('/api/contracts/:id/review/template', h((req) => {
    const contract = getRow('contracts', req.params.id);
    const existing = new Set(db.prepare('SELECT theme FROM review_items WHERE contract_id = ?').all(contract.id).map((r) => r.theme));
    let added = 0;
    for (const [theme, content] of reviewTemplateFor(contract)) {
      if (existing.has(theme)) continue;
      insert('review_items', { contract_id: contract.id, theme, content, status: 'à analyser', source: 'modèle' });
      added += 1;
    }
    return { added };
  }));

  // ---------- Matrice RACI lisible (noms des intervenants en colonnes) ----------
  app.get('/api/contracts/:id/raci.csv', h((req, res) => {
    const contract = getRow('contracts', req.params.id);
    const people = db.prepare('SELECT * FROM stakeholders WHERE contract_id = ? ORDER BY organisation, name').all(contract.id);
    const rows = db.prepare('SELECT * FROM raci_items WHERE contract_id = ? ORDER BY wbs_code, id').all(contract.id);
    const cell = (v) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [['WBS', 'Activité', ...people.map((p) => `${p.name}${p.organisation ? ` (${p.organisation})` : ''}`)].map(cell).join(';')];
    for (const r of rows) {
      let a = {};
      try { a = JSON.parse(r.assignments || '{}'); } catch { /* matrice vide */ }
      lines.push([r.wbs_code ?? '', r.activity, ...people.map((p) => a[p.id] ?? '')].map((v) => cell(String(v))).join(';'));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="raci-${safeName(contract.reference || String(contract.id))}.csv"`);
    res.send(`\uFEFF${lines.join('\r\n')}`);
  }));

  // ---------- Visas : nouvel indice ----------
  app.post('/api/submittals/:id/revision', h((req) => {
    const prev = getRow('submittals', req.params.id);
    const next = /^[A-Y]$/i.test(prev.revision ?? '') ? String.fromCharCode(prev.revision.toUpperCase().charCodeAt(0) + 1) : `${prev.revision ?? 'A'}+`;
    const row = insert('submittals', {
      contract_id: prev.contract_id, number: prev.number, title: prev.title, discipline: prev.discipline, revision: next,
      emitter: prev.emitter, reviewer: prev.reviewer, submitted_date: today(), visa_status: 'en attente',
    });
    return enrich('submittals', [row])[0];
  }));

  // ---------- Plannings : import, tâches, comparaison ----------
  app.post('/api/contracts/:id/schedule/import', upload.single('file'), h(async (req) => {
    const contract = getRow('contracts', req.params.id);
    if (!req.file) throw new HttpError(400, 'Aucun fichier reçu');
    let parsed;
    try {
      parsed = await parseSchedule(req.file.originalname, req.file.buffer);
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    const doc = await storeDocument({ contractId: contract.id, buffer: req.file.buffer, filename: req.file.originalname, mime: req.file.mimetype, meta: { category: 'Programme / Planning', doc_date: parsed.data_date || today() } });
    const imp = insert('schedule_imports', {
      contract_id: contract.id,
      name: req.body.name || req.file.originalname.replace(/\.[^.]+$/, ''),
      format: `${parsed.format} (marge ${parsed.float_source})`,
      data_date: parsed.data_date,
      planned_completion: parsed.planned_completion,
      task_count: parsed.tasks.length,
      critical_count: parsed.tasks.filter((t) => t.is_critical && !t.is_summary).length,
      document_id: doc.id,
    });
    const stmt = db.prepare(`INSERT INTO schedule_tasks (import_id, contract_id, ext_id, wbs_code, name, start, finish, baseline_start, baseline_finish,
      duration_days, percent_complete, total_float_days, is_critical, is_milestone, is_summary, outline_level, predecessors)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    db.exec('BEGIN');
    try {
      for (const t of parsed.tasks) {
        stmt.run(imp.id, contract.id, t.ext_id, t.wbs_code, t.name, t.start, t.finish, t.baseline_start, t.baseline_finish, t.duration_days,
          t.percent_complete, t.total_float_days, t.is_critical ? 1 : 0, t.is_milestone, t.is_summary, t.outline_level,
          t.predecessors.map((p) => `${p.id}${p.type === 'FS' ? '' : p.type}${p.lag_days ? `${p.lag_days > 0 ? '+' : ''}${p.lag_days}j` : ''}`).join(';') || null);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return imp;
  }));

  app.get('/api/schedule_imports/:id/tasks', h((req) => {
    getRow('schedule_imports', req.params.id);
    const critical = req.query.critical ? 'AND is_critical = 1 AND is_summary = 0' : '';
    return db.prepare(`SELECT * FROM schedule_tasks WHERE import_id = ? ${critical} ORDER BY start, id`).all(Number(req.params.id));
  }));

  app.get('/api/schedule-compare', h((req) => {
    const a = getRow('schedule_imports', req.query.from);
    const b = getRow('schedule_imports', req.query.to);
    const before = db.prepare('SELECT * FROM schedule_tasks WHERE import_id = ? AND is_summary = 0').all(a.id);
    const after = db.prepare('SELECT * FROM schedule_tasks WHERE import_id = ? AND is_summary = 0').all(b.id);
    const key = (t) => t.ext_id || t.name;
    const old = new Map(before.map((t) => [key(t), t]));
    const days = (x, y) => (x && y ? Math.round((Date.parse(y) - Date.parse(x)) / 86400000) : null);
    const changes = after
      .filter((t) => old.has(key(t)))
      .map((t) => ({ name: t.name, wbs_code: t.wbs_code, finish_before: old.get(key(t)).finish, finish_after: t.finish, delta_days: days(old.get(key(t)).finish, t.finish), is_critical: t.is_critical, was_critical: old.get(key(t)).is_critical }))
      .filter((c) => c.delta_days || c.is_critical !== c.was_critical)
      .sort((x, y) => Math.abs(y.delta_days ?? 0) - Math.abs(x.delta_days ?? 0))
      .slice(0, 200);
    return {
      from: a, to: b,
      completion_delta_days: days(a.planned_completion, b.planned_completion),
      added: after.filter((t) => !old.has(key(t))).length,
      removed: before.filter((t) => !after.some((x) => key(x) === key(t))).length,
      changes,
    };
  }));

  // Crée la WBS du contrat à partir des codes WBS d'un planning importé.
  app.post('/api/schedule_imports/:id/wbs', h((req) => {
    const imp = getRow('schedule_imports', req.params.id);
    const existing = new Set(db.prepare('SELECT code FROM wbs_items WHERE contract_id = ?').all(imp.contract_id).map((r) => r.code));
    const tasks = db.prepare('SELECT * FROM schedule_tasks WHERE import_id = ? AND wbs_code IS NOT NULL ORDER BY id').all(imp.id);
    let added = 0;
    for (const t of tasks) {
      // MS Project : tâches récapitulatives « 1.2 » ; Primavera : chemin WBS avant « · ».
      const code = t.wbs_code.includes(' · ') ? t.wbs_code.split(' · ')[0] : t.is_summary ? t.wbs_code : null;
      if (!code || existing.has(code)) continue;
      const parent = code.includes('.') ? code.slice(0, code.lastIndexOf('.')) : null;
      insert('wbs_items', { contract_id: imp.contract_id, code, title: t.is_summary ? t.name : code, parent_code: parent });
      existing.add(code);
      added += 1;
    }
    return { added };
  }));

  // ---------- Courriers ----------
  const letterEntity = (template, entityId) =>
    template.entity === 'contracts' || !entityId ? null : enrich(template.entity, [getRow(template.entity, entityId)])[0];

  app.get('/api/letters/templates', h((req) => listTemplates(req.query.contract_id ? getRow('contracts', req.query.contract_id) : null)));
  app.post('/api/letters/preview', h((req) => {
    const contract = getRow('contracts', req.body.contract_id);
    const template = TEMPLATES[req.body.template];
    if (!template) throw new HttpError(400, 'Modèle inconnu');
    return buildLetter(db, { templateId: req.body.template, contract, entity: letterEntity(template, req.body.entity_id), settings: getSettings(db), lang: req.body.lang });
  }));
  app.post('/api/letters/generate', h(async (req) => {
    const contract = getRow('contracts', req.body.contract_id);
    const template = TEMPLATES[req.body.template];
    if (!template) throw new HttpError(400, 'Modèle inconnu');
    const { subject, body, recipient, cc } = req.body;
    if (!subject || !body) throw new HttpError(400, 'Objet et corps du courrier obligatoires');
    const entity = letterEntity(template, req.body.entity_id);
    const settings = getSettings(db);
    const buffer = await renderDocx({ subject, body, recipient, cc, contract, settings, date: today(), lang: req.body.lang === 'en' ? 'en' : 'fr' });
    const link = {
      early_warning_id: template.entity === 'early_warnings' ? entity.id : entity?.early_warning_id ?? null,
      compensation_event_id: template.entity === 'compensation_events' ? entity.id : entity?.compensation_event_id ?? null,
    };
    const reference = nextNumber(db, 'correspondence', 'reference', contract.id, 'SOR');
    const correspondence = insert('correspondence', {
      contract_id: contract.id, direction: 'sortant', reference, subject, recipient, date: today(), status: 'à envoyer',
      type: ['early_warnings', 'compensation_events'].includes(template.entity) ? 'Notification NEC' : template.infoType === 'Mise en demeure' ? 'Mise en demeure' : 'Courrier',
      summary: body.slice(0, 4000), ...link,
    });
    const document = await storeDocument({
      contractId: contract.id,
      buffer,
      filename: safeName(`${reference} - ${subject}`).slice(0, 110) + '.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      meta: { category: 'Échange', title: subject, doc_date: today(), correspondence_id: correspondence.id, ...link },
    });
    return { correspondence, document: stripText(document) };
  }));

  // ---------- Paramètres et IA ----------
  const publicSettings = () => {
    const { claude_api_key: key, ...rest } = { ...AI_DEFAULTS, ...getSettings(db) };
    return { ...rest, has_claude_key: Boolean(key) };
  };
  app.get('/api/settings', h(() => publicSettings()));
  app.put('/api/settings', h((req) => {
    const allowed = ['company_name', 'company_address', 'city', 'signatory_name', 'signatory_title', 'ai_mode', 'ollama_url', 'ollama_model', 'claude_model', 'claude_effort', 'claude_api_key', 'ocr_mode', 'review_watch_ai', 'ecb_rate'];
    const values = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    // Une clé vide envoyée par le formulaire ne remplace pas la clé enregistrée.
    if (values.claude_api_key === '' || values.claude_api_key === undefined) delete values.claude_api_key;
    if (req.body.remove_claude_key) values.claude_api_key = null;
    setSettings(db, values);
    return publicSettings();
  }));
  // Bascule rapide du moteur d'IA (sélecteur de l'en-tête).
  app.get('/api/ai/status', h(() => aiStatus(db)));
  app.put('/api/ai/mode', h((req) => {
    if (!['ollama', 'claude', 'off'].includes(req.body.mode)) throw new HttpError(400, 'Moteur inconnu');
    setSettings(db, { ai_mode: req.body.mode });
    return aiStatus(db);
  }));
  app.post('/api/ai/test', h((req) => testProvider(db, req.body.provider === 'claude' ? 'claude' : 'ollama')));
  // Télécharge le modèle local depuis l'application (équivalent de « ollama pull »).
  app.post('/api/ai/ollama/pull', h(async (req) => {
    await startOllamaPull(db, req.body?.model);
    return aiStatus(db);
  }));

  const aiDocuments = (contractId, ids, forReview) => {
    let docs = db.prepare("SELECT id, title, category, content_text FROM documents WHERE contract_id = ? AND is_current = 1 AND text_status IN ('ok', 'ocr')").all(contractId);
    if (ids?.length) docs = docs.filter((d) => ids.includes(d.id));
    else if (forReview) docs = docs.filter((d) => !NOT_FOR_REVIEW.includes(d.category));
    const rank = (d) => (AI_CATEGORY_ORDER.includes(d.category) ? AI_CATEGORY_ORDER.indexOf(d.category) : 99);
    return docs.sort((a, b) => rank(a) - rank(b));
  };

  app.post('/api/ai/review', h((req) => {
    const contract = getRow('contracts', req.body.contract_id);
    return reviewContract(db, contract, aiDocuments(contract.id, req.body.document_ids, true));
  }));
  app.post('/api/ai/review/apply', h((req) => {
    const contract = getRow('contracts', req.body.contract_id);
    let created = 0;
    for (const r of req.body.review_items ?? []) {
      insert('review_items', { contract_id: contract.id, theme: r.theme, clause_ref: r.clause_ref, content: r.content, risk_level: r.risk_level, mitigation: r.mitigation, status: 'à analyser', source: 'IA' });
      created += 1;
    }
    for (const o of req.body.obligations ?? []) {
      insert('review_items', { contract_id: contract.id, theme: 'Obligation à délai', clause_ref: o.clause_ref, content: `${o.title} — ${o.deadline}`, risk_level: 'moyen', status: 'à analyser', source: 'IA' });
      created += 1;
    }
    for (const d of req.body.key_dates ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? '')) continue;
      insert('milestones', { contract_id: contract.id, title: d.title, type: 'Échéance contractuelle', planned_date: d.date, status: 'à venir', notes: d.clause_ref ? `Clause ${d.clause_ref} (proposé par l’IA)` : 'Proposé par l’IA' });
      created += 1;
    }
    return { created };
  }));
  app.post('/api/ai/ask', h((req) => {
    const contract = getRow('contracts', req.body.contract_id);
    if (!String(req.body.question ?? '').trim()) throw new HttpError(400, 'Question vide');
    return askContract(db, contract, aiDocuments(contract.id, req.body.document_ids, false), req.body.question);
  }));
  app.post('/api/ai/draft', h((req) => {
    const contract = getRow('contracts', req.body.contract_id);
    const template = TEMPLATES[req.body.template];
    const entity = template ? letterEntity(template, req.body.entity_id) : null;
    return draftLetter(db, contract, { subject: req.body.subject, body: req.body.body, instructions: req.body.instructions, facts: entity ? stripText(entity) : {} });
  }));
  app.post('/api/ai/triage', h((req) => {
    const message = getRow('correspondence', req.body.correspondence_id);
    const contract = getRow('contracts', message.contract_id);
    const attachments = db.prepare("SELECT title, content_text FROM documents WHERE correspondence_id = ? AND text_status IN ('ok', 'ocr')").all(message.id);
    return triageCorrespondence(db, contract, message, attachments.map((a) => `## ${a.title}\n${a.content_text}`).join('\n\n'));
  }));

  // ================= V3 =================

  // ---------- OCR à la demande ----------
  app.post('/api/documents/:id/ocr', h((req) => {
    const doc = getRow('documents', req.params.id);
    const ext = doc.original_name.toLowerCase().split('.').pop();
    if (!['pdf', 'png', 'jpg', 'jpeg', 'bmp', 'tif', 'tiff'].includes(ext)) throw new HttpError(400, 'L’OCR ne s’applique qu’aux PDF et aux images.');
    ocr.enqueue(doc.id);
    return { queued: true, pending: ocr.pending() };
  }));
  app.get('/api/ocr/status', h(() => ({
    pending: ocr.pending(),
    documents: db.prepare("SELECT text_status, COUNT(*) AS n FROM documents WHERE is_current = 1 AND text_status LIKE 'ocr%' GROUP BY text_status").all(),
  })));

  // ---------- Import / export Excel : revue, RACI, matrice de communication ----------
  const IMPORT_CATEGORY = { review: 'Revue de contrat', raci: 'RACI', communication: 'Matrice de communication' };
  const n = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const checkKind = (kind) => {
    if (!KINDS.includes(kind)) throw new HttpError(404, 'Type d’import inconnu');
  };
  const parseMapping = (raw) => {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'Correspondance de colonnes invalide');
    }
  };

  app.post('/api/contracts/:id/import/:kind/preview', upload.single('file'), h(async (req) => {
    getRow('contracts', req.params.id);
    checkKind(req.params.kind);
    if (!req.file) throw new HttpError(400, 'Aucun fichier reçu');
    const prep = await prepareImport(req.params.kind, req.file.originalname, req.file.buffer, { sheet: req.body.sheet, mapping: parseMapping(req.body.mapping) });
    return { ...prep, total: prep.items.length, items: prep.items.slice(0, 15) };
  }));

  app.post('/api/contracts/:id/import/:kind', upload.single('file'), h(async (req) => {
    const contract = getRow('contracts', req.params.id);
    const kind = req.params.kind;
    checkKind(kind);
    if (!req.file) throw new HttpError(400, 'Aucun fichier reçu');
    const prep = await prepareImport(kind, req.file.originalname, req.file.buffer, { sheet: req.body.sheet, mapping: parseMapping(req.body.mapping) });
    if (!prep.items.length) throw new HttpError(400, 'Aucune ligne exploitable dans le fichier : vérifiez la correspondance des colonnes.');
    const replace = req.body.mode === 'remplacer';
    const stamp = `[${today()} · import Excel « ${req.file.originalname} »]`;
    const result = { created: 0, updated: 0, stakeholders_created: 0 };
    db.exec('BEGIN');
    try {
      if (kind === 'review') {
        if (replace) db.prepare('DELETE FROM review_items WHERE contract_id = ?').run(contract.id);
        const existing = db.prepare('SELECT * FROM review_items WHERE contract_id = ?').all(contract.id);
        for (const it of prep.items) {
          const same = existing.find((e) => n(e.theme) === n(it.theme) && n(e.clause_ref) === n(it.clause_ref));
          const values = { theme: it.theme, clause_ref: it.clause_ref, content: it.content, risk_level: it.risk_level, mitigation: it.mitigation, owner: it.owner, status: it.status };
          if (same) {
            update('review_items', same.id, { ...values, risk_level: it.risk_level ?? same.risk_level, history: [`${stamp} Point mis à jour`, same.history].filter(Boolean).join('\n') });
            result.updated += 1;
          } else {
            insert('review_items', { contract_id: contract.id, ...values, source: 'import', history: `${stamp} Point importé` });
            result.created += 1;
          }
        }
      } else if (kind === 'communication') {
        if (replace) db.prepare('DELETE FROM communication_rules WHERE contract_id = ?').run(contract.id);
        const existing = db.prepare('SELECT * FROM communication_rules WHERE contract_id = ?').all(contract.id);
        for (const it of prep.items) {
          const same = existing.find((e) => n(e.subject) === n(it.subject));
          if (same) {
            update('communication_rules', same.id, it);
            result.updated += 1;
          } else {
            insert('communication_rules', { contract_id: contract.id, ...it });
            result.created += 1;
          }
        }
      } else {
        if (replace) db.prepare('DELETE FROM raci_items WHERE contract_id = ?').run(contract.id);
        // Colonnes du fichier → intervenants existants (par nom ou organisme), sinon création.
        const people = db.prepare('SELECT * FROM stakeholders WHERE contract_id = ?').all(contract.id);
        const idByHeader = {};
        for (const header of prep.people) {
          const m = header.match(/^(.*?)\s*\((.*)\)\s*$/);
          const name = (m ? m[1] : header).trim();
          const found = people.find((p) => n(p.name) === n(name) || n(p.organisation) === n(name) || n(`${p.name} (${p.organisation})`) === n(header));
          if (found) idByHeader[header] = found.id;
          else {
            const created = insert('stakeholders', { contract_id: contract.id, name, organisation: m ? m[2] : null, notes: 'Créé par import de la matrice RACI' });
            people.push(created);
            idByHeader[header] = created.id;
            result.stakeholders_created += 1;
          }
        }
        const existing = db.prepare('SELECT * FROM raci_items WHERE contract_id = ?').all(contract.id);
        for (const it of prep.items) {
          const assignments = Object.fromEntries(Object.entries(it.cells).map(([h, v]) => [idByHeader[h], v]));
          const same = existing.find((e) => n(e.activity) === n(it.activity));
          if (same) {
            let prev = {};
            try { prev = JSON.parse(same.assignments || '{}'); } catch { prev = {}; }
            update('raci_items', same.id, { wbs_code: it.wbs_code ?? same.wbs_code, assignments: JSON.stringify({ ...prev, ...assignments }) });
            result.updated += 1;
          } else {
            insert('raci_items', { contract_id: contract.id, activity: it.activity, wbs_code: it.wbs_code, assignments: JSON.stringify(assignments) });
            result.created += 1;
          }
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    // Le fichier source est conservé dans la GED, comme nouvelle version s'il a déjà été importé.
    const previous = db.prepare('SELECT id FROM documents WHERE contract_id = ? AND category = ? AND original_name = ? AND is_current = 1').get(contract.id, IMPORT_CATEGORY[kind], safeName(req.file.originalname));
    await storeDocument({ contractId: contract.id, buffer: req.file.buffer, filename: req.file.originalname, mime: req.file.mimetype, meta: { category: IMPORT_CATEGORY[kind], doc_date: today(), parent_id: previous?.id } });
    return { ...result, warnings: prep.warnings };
  }));

  app.get('/api/contracts/:id/export/:kind.xlsx', h(async (req, res) => {
    const contract = getRow('contracts', req.params.id);
    const kind = req.params.kind;
    checkKind(kind);
    const table = { review: 'review_items', raci: 'raci_items', communication: 'communication_rules' }[kind];
    const order = { review: "CASE risk_level WHEN 'critique' THEN 0 WHEN 'élevé' THEN 1 WHEN 'moyen' THEN 2 ELSE 3 END, id", raci: 'wbs_code, id', communication: 'id' }[kind];
    const items = db.prepare(`SELECT * FROM ${table} WHERE contract_id = ? ORDER BY ${order}`).all(contract.id);
    const people = kind === 'raci' ? db.prepare('SELECT * FROM stakeholders WHERE contract_id = ? ORDER BY organisation, name').all(contract.id) : [];
    const buffer = await buildExport(kind, { contract, items, people });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${IMPORT_CATEGORY[kind]} - ${contract.reference || contract.title}.xlsx`)}`);
    res.send(buffer);
  }));

  app.get('/api/import-templates/:kind.xlsx', h(async (req, res) => {
    checkKind(req.params.kind);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`Modèle ${IMPORT_CATEGORY[req.params.kind]}.xlsx`)}`);
    res.send(await buildTemplate(req.params.kind));
  }));

  // ---------- Veille de revue : propositions à valider ----------
  app.get('/api/review_updates', h((req) => {
    const where = ['u.contract_id = ?'];
    const args = [Number(req.query.contract_id)];
    if (req.query.status) { where.push('u.status = ?'); args.push(String(req.query.status)); }
    return db.prepare(`
      SELECT u.*, r.theme AS item_theme, r.clause_ref AS item_clause, r.risk_level AS item_risk, r.status AS item_status
      FROM review_updates u LEFT JOIN review_items r ON r.id = u.review_item_id
      WHERE ${where.join(' AND ')} ORDER BY u.id DESC LIMIT 200`).all(...args);
  }));
  app.post('/api/review_updates/:id/:decision', h((req) => {
    const u = getRow('review_updates', req.params.id);
    if (u.status !== 'proposée') throw new HttpError(409, 'Proposition déjà traitée');
    if (!['accept', 'reject'].includes(req.params.decision)) throw new HttpError(404, 'Décision inconnue');
    let itemId = u.review_item_id;
    if (req.params.decision === 'accept') {
      itemId = acceptUpdate(db, u);
      logJournal(db, { contract_id: u.contract_id, entity: 'review_items', entity_id: itemId, action: 'veille acceptée', summary: u.trigger_label });
    }
    db.prepare("UPDATE review_updates SET status = ?, decided_at = datetime('now','localtime') WHERE id = ?").run(req.params.decision === 'accept' ? 'acceptée' : 'rejetée', u.id);
    return { ok: true, review_item_id: itemId };
  }));
  app.post('/api/contracts/:id/review/reanalyze', h(async (req) => {
    const contract = getRow('contracts', req.params.id);
    const created = await watch.reanalyze(contract.id);
    return { created };
  }));

  // ---------- Système : état, sauvegardes, arrêt ----------
  app.get('/api/health', h(() => ({ ok: true, app: 'contrats-app', version: APP_VERSION })));
  app.get('/api/backups', h(() => listBackups(dataDir)));
  app.post('/api/system/shutdown', h((req, res) => {
    res.json({ ok: true });
    setTimeout(() => onShutdown?.(), 200);
  }));

  /** Extrait le texte des documents qui ne l'ont pas encore été (documents de la V1). */
  app.locals.reindexMissing = async () => {
    const docs = db.prepare('SELECT * FROM documents WHERE text_status IS NULL').all();
    for (const doc of docs) {
      const file = files.absolutePath(doc);
      if (!fs.existsSync(file)) continue;
      const { text, status } = await extractDocumentText(doc.original_name, fs.readFileSync(file));
      db.prepare('UPDATE documents SET content_text = ?, text_status = ? WHERE id = ?').run(text || null, status, doc.id);
      indexDocument(db, doc, text);
    }
    if (ocrEnabled()) ocr.resume();
    return docs.length;
  };

  // ---------- Interface web ----------
  const dist = path.resolve(import.meta.dirname, '..', 'dist');
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    const index = path.join(dist, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.status(503).send('Interface non construite : lancez « npm run build ».');
  });

  app.use((req, res) => res.status(404).json({ error: 'Route inconnue' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status ?? (err instanceof multer.MulterError ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || 'Erreur interne' });
  });

  return app;
}
