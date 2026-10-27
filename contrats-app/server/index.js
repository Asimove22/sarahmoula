import path from 'node:path';
import { exec } from 'node:child_process';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node.js ${process.versions.node} est trop ancien : installez la version LTS (22 ou plus) depuis https://nodejs.org`);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 4580;
const dataDir = path.resolve(process.env.DATA_DIR || path.join(import.meta.dirname, '..', 'data'));
const db = openDatabase(dataDir);
const app = createApp({ db, dataDir });

// Écoute uniquement sur la machine locale : l'application n'est pas exposée au réseau.
app.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Gestion contractuelle démarrée : ${url}`);
  console.log(`  Données : ${dataDir}`);
  console.log('  Fermez cette fenêtre pour arrêter l’application.\n');
  if (process.env.OPEN_BROWSER) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(cmd);
  }
});
