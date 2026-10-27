import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { logJournal } from './db.js';

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  eml: 'message/rfc822',
  msg: 'application/vnd.ms-outlook',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function guessMime(filename, fallback) {
  return MIME_BY_EXT[filename.toLowerCase().split('.').pop()] ?? fallback ?? 'application/octet-stream';
}

/** Nom de fichier sûr pour Windows, en gardant les accents. */
export function safeName(name) {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();
  return (cleaned || 'fichier').slice(-120);
}

export function createFileStore(dataDir) {
  const filesDir = path.join(dataDir, 'files');
  const trashDir = path.join(dataDir, 'corbeille');
  fs.mkdirSync(filesDir, { recursive: true });

  return {
    filesDir,

    absolutePath(doc) {
      return path.join(filesDir, doc.stored_name);
    },

    /** Écrit le fichier sur disque et crée la fiche document. */
    save(db, { contractId, buffer, filename, mime, meta = {} }) {
      const name = safeName(filename);
      const dir = path.join(filesDir, String(contractId));
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
      const storedName = `${contractId}/${stamp}-${crypto.randomBytes(3).toString('hex')}-${name}`;
      fs.writeFileSync(path.join(filesDir, storedName), buffer);

      let version = 1;
      let familyId = null;
      if (meta.parent_id) {
        const parent = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(meta.parent_id));
        if (parent) {
          familyId = parent.family_id ?? parent.id;
          const max = db.prepare('SELECT MAX(version) AS v FROM documents WHERE family_id = ? OR id = ?').get(familyId, familyId);
          version = (max.v ?? parent.version) + 1;
          db.prepare('UPDATE documents SET is_current = 0 WHERE family_id = ? OR id = ?').run(familyId, familyId);
          meta = { category: parent.category, title: parent.title, reference: parent.reference, ...meta };
        }
      }

      const title = meta.title || name.replace(/\.[^.]+$/, '');
      const result = db
        .prepare(
          `INSERT INTO documents (contract_id, family_id, version, category, title, reference, doc_date, original_name,
             stored_name, mime, size, sha256, correspondence_id, early_warning_id, compensation_event_id, submittal_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          Number(contractId),
          familyId,
          version,
          meta.category || 'Autre',
          title,
          meta.reference || null,
          meta.doc_date || null,
          name,
          storedName,
          guessMime(name, mime),
          buffer.length,
          crypto.createHash('sha256').update(buffer).digest('hex'),
          meta.correspondence_id ? Number(meta.correspondence_id) : null,
          meta.early_warning_id ? Number(meta.early_warning_id) : null,
          meta.compensation_event_id ? Number(meta.compensation_event_id) : null,
          meta.submittal_id ? Number(meta.submittal_id) : null,
          meta.notes || null,
        );
      const id = Number(result.lastInsertRowid);
      if (!familyId) db.prepare('UPDATE documents SET family_id = ? WHERE id = ?').run(id, id);
      logJournal(db, {
        contract_id: Number(contractId),
        entity: 'documents',
        entity_id: id,
        action: version > 1 ? 'nouvelle version' : 'ajout',
        summary: `${title} (v${version})`,
      });
      return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    },

    /** Les fichiers supprimés sont déplacés dans data/corbeille, jamais effacés. */
    trash(doc) {
      const src = path.join(filesDir, doc.stored_name);
      if (!fs.existsSync(src)) return;
      const dest = path.join(trashDir, doc.stored_name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(src, dest);
    },
  };
}
