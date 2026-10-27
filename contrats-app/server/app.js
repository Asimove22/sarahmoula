import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { columnsOf, toSql, logJournal } from './db.js';
import { computeDeadlines, ceDerived, today, addDays } from './deadlines.js';
import { buildIcs } from './ics.js';
import { parseEmail } from './mail.js';
import { createFileStore } from './files.js';

const LABELS = {
  contracts: 'contrat',
  early_warnings: 'early warning',
  compensation_events: 'compensation event',
  correspondence: 'courrier',
  milestones: 'jalon',
  documents: 'document',
};

// Colonnes de documents que l'utilisateur peut modifier (le fichier lui-même est immuable).
const DOCUMENT_EDITABLE = ['category', 'title', 'reference', 'doc_date', 'notes', 'correspondence_id', 'early_warning_id', 'compensation_event_id'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const describe = (row) => row.title ?? row.subject ?? `#${row.id}`;

/** Prochain numéro de registre : EW-001, CE-002, ENT-003… */
function nextNumber(db, table, column, contractId, prefix) {
  const rows = db.prepare(`SELECT ${column} AS n FROM ${table} WHERE contract_id = ? AND ${column} LIKE ?`).all(contractId, `${prefix}-%`);
  const max = rows.reduce((m, r) => Math.max(m, Number.parseInt(String(r.n).slice(prefix.length + 1), 10) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function createApp({ db, dataDir }) {
  const app = express();
  const files = createFileStore(dataDir);
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
  app.get('/api/contracts/:id', h((req) => getRow('contracts', req.params.id)));
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
  };

  const enrich = (table, rows) => {
    if (table !== 'compensation_events') return rows;
    const contracts = new Map();
    return rows.map((r) => {
      if (!contracts.has(r.contract_id)) contracts.set(r.contract_id, getRow('contracts', r.contract_id));
      return { ...r, ...ceDerived(r, contracts.get(r.contract_id)) };
    });
  };

  for (const [table, cfg] of Object.entries(registers)) {
    app.get(`/api/${table}`, h((req) => {
      const filters = [];
      const args = [];
      if (req.query.contract_id) { filters.push('t.contract_id = ?'); args.push(Number(req.query.contract_id)); }
      if (req.query.status) { filters.push('t.status = ?'); args.push(String(req.query.status)); }
      const extra = table === 'correspondence'
        ? ', (SELECT COUNT(*) FROM documents d WHERE d.correspondence_id = t.id) AS documents_count'
        : table === 'early_warnings' || table === 'compensation_events'
          ? `, (SELECT COUNT(*) FROM documents d WHERE d.${table === 'early_warnings' ? 'early_warning_id' : 'compensation_event_id'} = t.id) AS documents_count`
          : '';
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
    for (const key of ['contract_id', 'correspondence_id', 'early_warning_id', 'compensation_event_id']) {
      if (req.query[key]) { filters.push(`d.${key} = ?`); args.push(Number(req.query[key])); }
    }
    if (req.query.category) { filters.push('d.category = ?'); args.push(String(req.query.category)); }
    if (!req.query.all_versions) filters.push('d.is_current = 1');
    return db.prepare(`
      SELECT d.*, c.title AS contract_title,
        (SELECT COUNT(*) FROM documents v WHERE v.family_id = d.family_id) AS versions_count
      FROM documents d JOIN contracts c ON c.id = d.contract_id
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY COALESCE(d.doc_date, substr(d.created_at, 1, 10)) DESC, d.id DESC`).all(...args);
  }));
  app.get('/api/documents/:id/versions', h((req) => {
    const doc = getRow('documents', req.params.id);
    return db.prepare('SELECT * FROM documents WHERE family_id = ? ORDER BY version DESC').all(doc.family_id ?? doc.id);
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
  app.post('/api/documents/upload', upload.array('files'), h((req) => {
    const { contract_id: contractId, ...meta } = req.body;
    getRow('contracts', contractId);
    if (!req.files?.length) throw new HttpError(400, 'Aucun fichier reçu');
    if (meta.parent_id && req.files.length > 1) throw new HttpError(400, 'Une nouvelle version ne peut contenir qu’un seul fichier');
    return req.files.map((f) => files.save(db, {
      contractId,
      buffer: f.buffer,
      filename: f.originalname,
      mime: f.mimetype,
      meta: req.files.length > 1 ? { ...meta, title: '' } : meta,
    }));
  }));
  app.put('/api/documents/:id', h((req) => update('documents', req.params.id, req.body, DOCUMENT_EDITABLE)));
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
      files.save(db, { contractId, buffer: f.buffer, filename, mime: f.mimetype, meta: { ...docMeta, category: 'Échange', title: record.subject } });
      for (const att of email?.attachments ?? []) {
        files.save(db, { contractId, buffer: att.content, filename: att.filename, mime: att.mime, meta: { ...docMeta, category: 'Pièce jointe' } });
      }
      created.push({ ...row, attachments: email?.attachments.length ?? 0 });
    }
    return created;
  }));

  // ---------- Échéances, tableau de bord, calendrier ----------
  app.get('/api/deadlines', h((req) => computeDeadlines(db, { contractId: req.query.contract_id })));

  app.get('/api/dashboard', h(() => {
    const deadlines = computeDeadlines(db);
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
      },
      overdue: deadlines.filter((d) => d.overdue),
      upcoming: deadlines.filter((d) => !d.overdue && d.date <= horizon30),
      recent_activity: db.prepare(`
        SELECT j.*, c.title AS contract_title FROM journal j LEFT JOIN contracts c ON c.id = j.contract_id
        ORDER BY j.id DESC LIMIT 15`).all(),
    };
  }));

  app.get('/api/calendar.ics', h((req, res) => {
    const deadlines = computeDeadlines(db, { contractId: req.query.contract_id }).filter((d) => !d.overdue);
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
      ...run('documents', `SELECT d.id, d.contract_id, d.title, d.category || ' · ' || d.original_name AS subtitle FROM documents d
        WHERE d.is_current = 1 AND (d.title LIKE ? OR d.original_name LIKE ? OR d.reference LIKE ? OR d.notes LIKE ?) LIMIT 50`, 4),
      ...run('correspondence', `SELECT id, contract_id, subject AS title, COALESCE(reference, '') || ' · ' || COALESCE(sender, '') AS subtitle FROM correspondence
        WHERE subject LIKE ? OR reference LIKE ? OR sender LIKE ? OR recipient LIKE ? OR summary LIKE ? LIMIT 50`, 5),
      ...run('early_warnings', `SELECT id, contract_id, title, number AS subtitle FROM early_warnings
        WHERE title LIKE ? OR number LIKE ? OR description LIKE ? OR actions LIKE ? LIMIT 30`, 4),
      ...run('compensation_events', `SELECT id, contract_id, title, number AS subtitle FROM compensation_events
        WHERE title LIKE ? OR number LIKE ? OR description LIKE ? OR clause LIKE ? LIMIT 30`, 4),
    ];
  }));

  // ---------- Exports CSV (ouvrables dans Excel) ----------
  app.get('/api/export/:table.csv', h((req, res) => {
    const table = req.params.table;
    if (!LABELS[table]) throw new HttpError(404, 'Registre inconnu');
    const where = req.query.contract_id && table !== 'contracts' ? 'WHERE t.contract_id = ?' : '';
    const args = where ? [Number(req.query.contract_id)] : [];
    let rows = db.prepare(`SELECT t.* FROM ${table} t ${where} ORDER BY t.id`).all(...args);
    rows = enrich(table, rows);
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
