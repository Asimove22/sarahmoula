// Sauvegarde automatique quotidienne de la base (les fichiers archivés ne sont jamais modifiés ni effacés).
import fs from 'node:fs';
import path from 'node:path';
import { today } from './deadlines.js';

const KEEP = 14;

export function autoBackup(db, dataDir) {
  const dir = path.join(dataDir, 'sauvegardes-auto');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `contrats-${today()}.db`);
  if (fs.existsSync(target)) return null;
  // VACUUM INTO produit une copie cohérente même pendant l'utilisation.
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  const old = fs.readdirSync(dir).filter((f) => /^contrats-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -KEEP);
  for (const f of old) fs.rmSync(path.join(dir, f));
  return target;
}

export function listBackups(dataDir) {
  const dir = path.join(dataDir, 'sauvegardes-auto');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse()
    .map((f) => ({ name: f, size: fs.statSync(path.join(dir, f)).size }));
}
