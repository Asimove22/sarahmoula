import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT,
  title TEXT NOT NULL,
  framework TEXT NOT NULL DEFAULT 'NEC4',
  nec_option TEXT,
  my_role TEXT,
  counterparty TEXT,
  project TEXT,
  amount REAL,
  currency TEXT DEFAULT 'EUR',
  signature_date TEXT,
  start_date TEXT,
  completion_date TEXT,
  end_date TEXT,
  notice_period_days INTEGER,
  tacit_renewal INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'actif',
  project_manager TEXT,
  supervisor TEXT,
  contacts TEXT,
  ce_notify_weeks INTEGER DEFAULT 8,
  pm_reply_weeks INTEGER DEFAULT 1,
  quote_weeks INTEGER DEFAULT 3,
  pm_quote_reply_weeks INTEGER DEFAULT 2,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS early_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  raised_by TEXT,
  date_notified TEXT,
  affects_price INTEGER DEFAULT 0,
  affects_completion INTEGER DEFAULT 0,
  affects_key_date INTEGER DEFAULT 0,
  affects_performance INTEGER DEFAULT 0,
  probability TEXT,
  impact TEXT,
  owner TEXT,
  actions TEXT,
  next_review_date TEXT,
  status TEXT NOT NULL DEFAULT 'ouvert',
  closed_date TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS compensation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  clause TEXT,
  early_warning_id INTEGER REFERENCES early_warnings(id) ON DELETE SET NULL,
  notified_by TEXT,
  date_aware TEXT,
  date_notified TEXT,
  pm_reply_date TEXT,
  pm_decision TEXT,
  quotation_instructed_date TEXT,
  quotation_submitted_date TEXT,
  pm_quote_reply_date TEXT,
  quoted_amount REAL,
  quoted_days INTEGER,
  assessed_amount REAL,
  assessed_days INTEGER,
  status TEXT NOT NULL DEFAULT 'notifié',
  implemented_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS correspondence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'entrant',
  type TEXT,
  reference TEXT,
  subject TEXT NOT NULL,
  sender TEXT,
  recipient TEXT,
  date TEXT,
  response_required INTEGER DEFAULT 0,
  response_due TEXT,
  response_date TEXT,
  status TEXT NOT NULL DEFAULT 'à traiter',
  early_warning_id INTEGER REFERENCES early_warnings(id) ON DELETE SET NULL,
  compensation_event_id INTEGER REFERENCES compensation_events(id) ON DELETE SET NULL,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT,
  planned_date TEXT,
  forecast_date TEXT,
  actual_date TEXT,
  status TEXT NOT NULL DEFAULT 'à venir',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  family_id INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  is_current INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'Autre',
  title TEXT NOT NULL,
  reference TEXT,
  doc_date TEXT,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  sha256 TEXT,
  correspondence_id INTEGER REFERENCES correspondence(id) ON DELETE SET NULL,
  early_warning_id INTEGER REFERENCES early_warnings(id) ON DELETE SET NULL,
  compensation_event_id INTEGER REFERENCES compensation_events(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  summary TEXT,
  at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_ew_contract ON early_warnings(contract_id);
CREATE INDEX IF NOT EXISTS idx_ce_contract ON compensation_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_corr_contract ON correspondence(contract_id);
CREATE INDEX IF NOT EXISTS idx_ms_contract ON milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_doc_contract ON documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_doc_family ON documents(family_id);
CREATE INDEX IF NOT EXISTS idx_journal_contract ON journal(contract_id);
`;

const TIMESTAMPS = "created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT";
const OWNED = 'contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE';

// Chaque migration s'exécute une seule fois ; PRAGMA user_version mémorise la dernière appliquée.
// Ne jamais modifier une migration publiée : en ajouter une nouvelle à la fin.
const MIGRATIONS = [
  // V2 : finances, programmes NEC, visas, organisation, revue, plannings, recherche plein texte, IA.
  `
  ALTER TABLE contracts ADD COLUMN reception_date TEXT;
  ALTER TABLE contracts ADD COLUMN payment_days INTEGER;
  ALTER TABLE contracts ADD COLUMN retention_percent REAL;
  ALTER TABLE contracts ADD COLUMN advance_amount REAL;
  ALTER TABLE contracts ADD COLUMN penalty_terms TEXT;
  ALTER TABLE contracts ADD COLUMN price_revision TEXT;
  ALTER TABLE contracts ADD COLUMN programme_interval_weeks INTEGER;
  ALTER TABLE contracts ADD COLUMN pm_programme_reply_weeks INTEGER DEFAULT 2;
  ALTER TABLE contracts ADD COLUMN visa_days INTEGER DEFAULT 15;
  ALTER TABLE contracts ADD COLUMN group_type TEXT;
  ALTER TABLE contracts ADD COLUMN ai_allow_cloud INTEGER DEFAULT 0;

  ALTER TABLE documents ADD COLUMN content_text TEXT;
  ALTER TABLE documents ADD COLUMN text_status TEXT;
  ALTER TABLE documents ADD COLUMN submittal_id INTEGER REFERENCES submittals(id) ON DELETE SET NULL;
  CREATE VIRTUAL TABLE documents_fts USING fts5(title, content, tokenize = 'unicode61 remove_diacritics 2');

  CREATE TABLE amendments (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, number TEXT, title TEXT NOT NULL,
    signature_date TEXT, amount REAL, extra_days INTEGER, status TEXT NOT NULL DEFAULT 'en négociation', description TEXT, ${TIMESTAMPS});
  CREATE TABLE payments (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, number TEXT, period TEXT,
    submitted_date TEXT, amount_requested REAL, validated_date TEXT, amount_validated REAL, due_date TEXT,
    paid_date TEXT, amount_paid REAL, status TEXT NOT NULL DEFAULT 'soumise', notes TEXT, ${TIMESTAMPS});
  CREATE TABLE programmes (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, number TEXT, title TEXT NOT NULL,
    submitted_date TEXT, pm_response_date TEXT, decision TEXT, reasons TEXT, planned_completion TEXT,
    status TEXT NOT NULL DEFAULT 'soumis', notes TEXT, ${TIMESTAMPS});
  CREATE TABLE submittals (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, number TEXT, title TEXT NOT NULL,
    discipline TEXT, revision TEXT DEFAULT 'A', emitter TEXT, reviewer TEXT, submitted_date TEXT, visa_due TEXT,
    visa_date TEXT, visa_status TEXT NOT NULL DEFAULT 'en attente', comments TEXT, ${TIMESTAMPS});
  CREATE TABLE stakeholders (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, name TEXT NOT NULL,
    organisation TEXT, role TEXT, email TEXT, phone TEXT, notes TEXT, ${TIMESTAMPS});
  CREATE TABLE group_members (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, company TEXT NOT NULL,
    role TEXT DEFAULT 'cotraitant', share_percent REAL, amount REAL, scope TEXT, contact TEXT, notes TEXT, ${TIMESTAMPS});
  CREATE TABLE wbs_items (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, code TEXT NOT NULL, title TEXT NOT NULL,
    parent_code TEXT, budget REAL, owner TEXT, description TEXT, ${TIMESTAMPS});
  CREATE TABLE raci_items (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, activity TEXT NOT NULL,
    wbs_code TEXT, assignments TEXT NOT NULL DEFAULT '{}', notes TEXT, ${TIMESTAMPS});
  CREATE TABLE communication_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, subject TEXT NOT NULL,
    info_type TEXT, sender TEXT, recipients TEXT, cc TEXT, channel TEXT, frequency TEXT, delay_days INTEGER,
    clause TEXT, notes TEXT, ${TIMESTAMPS});
  CREATE TABLE review_items (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, theme TEXT NOT NULL, clause_ref TEXT,
    content TEXT, risk_level TEXT, mitigation TEXT, owner TEXT, status TEXT NOT NULL DEFAULT 'à analyser',
    source TEXT DEFAULT 'manuel', ${TIMESTAMPS});
  CREATE TABLE schedule_imports (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, name TEXT NOT NULL, format TEXT,
    data_date TEXT, planned_completion TEXT, task_count INTEGER, critical_count INTEGER,
    document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL, ${TIMESTAMPS});
  CREATE TABLE schedule_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER NOT NULL REFERENCES schedule_imports(id) ON DELETE CASCADE, contract_id INTEGER NOT NULL,
    ext_id TEXT, wbs_code TEXT, name TEXT, start TEXT, finish TEXT, baseline_start TEXT, baseline_finish TEXT,
    duration_days REAL, percent_complete REAL, total_float_days REAL, is_critical INTEGER DEFAULT 0,
    is_milestone INTEGER DEFAULT 0, is_summary INTEGER DEFAULT 0, outline_level INTEGER, predecessors TEXT);
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);

  CREATE INDEX idx_amend_contract ON amendments(contract_id);
  CREATE INDEX idx_pay_contract ON payments(contract_id);
  CREATE INDEX idx_prog_contract ON programmes(contract_id);
  CREATE INDEX idx_sub_contract ON submittals(contract_id);
  CREATE INDEX idx_stake_contract ON stakeholders(contract_id);
  CREATE INDEX idx_group_contract ON group_members(contract_id);
  CREATE INDEX idx_wbs_contract ON wbs_items(contract_id);
  CREATE INDEX idx_raci_contract ON raci_items(contract_id);
  CREATE INDEX idx_comm_contract ON communication_rules(contract_id);
  CREATE INDEX idx_review_contract ON review_items(contract_id);
  CREATE INDEX idx_simport_contract ON schedule_imports(contract_id);
  CREATE INDEX idx_stask_import ON schedule_tasks(import_id);
  `,
  // V3 : OCR, historique des points de revue, mises à jour de revue proposées après un événement.
  `
  ALTER TABLE documents ADD COLUMN ocr_confidence REAL;
  ALTER TABLE review_items ADD COLUMN history TEXT;
  CREATE TABLE review_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED},
    review_item_id INTEGER REFERENCES review_items(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'mise à jour', trigger_entity TEXT, trigger_id INTEGER, trigger_label TEXT,
    proposed TEXT NOT NULL DEFAULT '{}', rationale TEXT, source TEXT NOT NULL DEFAULT 'règle',
    status TEXT NOT NULL DEFAULT 'proposée', decided_at TEXT, ${TIMESTAMPS});
  CREATE INDEX idx_rupd_contract ON review_updates(contract_id, status);
  `,
  // V4 : moteur d'IA par contrat, droit des marchés publics (CCAG 2021, Code de la commande publique).
  `
  ALTER TABLE contracts ADD COLUMN ai_provider TEXT;
  UPDATE contracts SET ai_provider = 'claude' WHERE ai_allow_cloud = 1;
  ALTER TABLE contracts ADD COLUMN buyer_type TEXT;
  ALTER TABLE contracts ADD COLUMN ccag TEXT;
  ALTER TABLE contracts ADD COLUMN procedure TEXT;
  ALTER TABLE contracts ADD COLUMN notification_date TEXT;
  ALTER TABLE contracts ADD COLUMN amount_ttc_rate REAL DEFAULT 20;
  ALTER TABLE contracts ADD COLUMN final_account_sent_date TEXT;
  ALTER TABLE contracts ADD COLUMN dgd_notified_date TEXT;
  ALTER TABLE contracts ADD COLUMN dgd_signed_date TEXT;
  ALTER TABLE contracts ADD COLUMN dgd_reserves INTEGER DEFAULT 0;
  CREATE TABLE service_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, number TEXT, title TEXT NOT NULL,
    kind TEXT, issued_date TEXT, received_date TEXT, effect_date TEXT, amount REAL, extra_days INTEGER,
    reserves_due TEXT, reserves_date TEXT, reserves_text TEXT, status TEXT NOT NULL DEFAULT 'reçu', notes TEXT, ${TIMESTAMPS});
  CREATE TABLE claims (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, number TEXT, title TEXT NOT NULL,
    dispute_date TEXT, memo_due TEXT, memo_sent_date TEXT, amount_claimed REAL, extra_days_claimed INTEGER,
    response_due TEXT, response_date TEXT, decision TEXT, amount_obtained REAL, next_step TEXT,
    status TEXT NOT NULL DEFAULT 'différend', notes TEXT, ${TIMESTAMPS});
  CREATE TABLE subcontractors (id INTEGER PRIMARY KEY AUTOINCREMENT, ${OWNED}, company TEXT NOT NULL,
    scope TEXT, amount_ht REAL, direct_payment INTEGER, dc4_date TEXT, approval_date TEXT,
    status TEXT NOT NULL DEFAULT 'en cours d’agrément', contact TEXT, notes TEXT, ${TIMESTAMPS});
  CREATE INDEX idx_os_contract ON service_orders(contract_id);
  CREATE INDEX idx_claims_contract ON claims(contract_id);
  CREATE INDEX idx_sub_contract2 ON subcontractors(contract_id);
  `,
];

export function openDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'contrats.db'));
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

function migrate(db) {
  let version = db.prepare('PRAGMA user_version').get().user_version;
  while (version < MIGRATIONS.length) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      version += 1;
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Échec de la mise à niveau de la base (étape ${version + 1}) : ${e.message}`);
    }
  }
}

export function getSettings(db) {
  return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
}

export function setSettings(db, values) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(values)) stmt.run(k, v === null || v === undefined ? null : String(v));
}

/** Writable columns of a table (everything except the id and creation timestamp). */
export function columnsOf(db, table) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name)
    .filter((n) => !['id', 'created_at', 'content_text'].includes(n));
}

/** node:sqlite only binds null, numbers, strings and buffers. */
export function toSql(value) {
  if (value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export function logJournal(db, { contract_id, entity, entity_id, action, summary }) {
  db.prepare(
    'INSERT INTO journal (contract_id, entity, entity_id, action, summary) VALUES (?, ?, ?, ?, ?)',
  ).run(contract_id ?? null, entity, entity_id ?? null, action, summary ?? null);
}
