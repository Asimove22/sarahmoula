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

export function openDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'contrats.db'));
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/** Writable columns of a table (everything except the id and creation timestamp). */
export function columnsOf(db, table) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name)
    .filter((n) => n !== 'id' && n !== 'created_at');
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
