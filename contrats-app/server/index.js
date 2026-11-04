import path from 'node:path';
import { exec } from 'node:child_process';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { autoBackup } from './backup.js';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node.js ${process.versions.node} est trop ancien : installez la version LTS (22 ou plus) depuis https://nodejs.org`);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 4580;
const URL_APP = `http://localhost:${PORT}`;
const dataDir = path.resolve(process.env.DATA_DIR || path.join(import.meta.dirname, '..', 'data'));

/** Ouvre l'application dans une fenêtre dédiée (Edge en mode application), sinon dans le navigateur par défaut. */
function openWindow() {
  if (!process.env.OPEN_BROWSER) return;
  if (process.platform === 'win32') {
    exec(`start "" msedge --app=${URL_APP}`, (err) => err && exec(`start "" "${URL_APP}"`));
  } else {
    exec(process.platform === 'darwin' ? `open ${URL_APP}` : `xdg-open ${URL_APP}`);
  }
}

// Déjà lancée (double clic sur l'icône) : on ouvre simplement la fenêtre.
// Une AUTRE installation (ancien dossier après une mise à jour) occupe le port : on le dit clairement.
let running = null;
try {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(4000) });
  if (res.ok) running = await res.json();
} catch {
  // rien n'écoute : démarrage normal
}
if (running?.app === 'contrats-app') {
  const here = path.resolve(import.meta.dirname, '..');
  if (running.root && path.resolve(running.root) === here) {
    console.log('  L’application est déjà démarrée : ouverture de la fenêtre.');
    openWindow();
    process.exit(0);
  }
  console.error(`\n  ATTENTION : une AUTRE installation de Clausia (version ${running.version ?? 'ancienne'}) est déjà lancée.`);
  console.error(`  Dossier en cours d'exécution : ${running.root ?? 'ancien dossier (version antérieure à 5.0.6)'}`);
  if (running.data_dir) console.error(`  Données utilisées : ${running.data_dir} (${running.contracts} contrat(s))`);
  console.error(`  Ce lanceur : ${here}`);
  console.error('  Arrêtez l’autre copie (Paramètres → Arrêter l’application, ou Gestionnaire des tâches → Node.js → Fin de tâche), puis relancez.\n');
  process.exit(1);
}

const db = openDatabase(dataDir);

async function shutdown() {
  console.log('\n  Arrêt de l’application…');
  try {
    await app.locals.ocr.close();
    db.close();
  } finally {
    process.exit(0);
  }
}

const app = createApp({ db, dataDir, onShutdown: shutdown });

const backup = () => {
  try {
    const file = autoBackup(db, dataDir);
    if (file) console.log(`  Sauvegarde automatique de la base : ${file}`);
  } catch (e) {
    console.warn('  Sauvegarde automatique impossible :', e.message);
  }
};

// Écoute uniquement sur la machine locale : l'application n'est pas exposée au réseau.
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Gestion contractuelle démarrée : ${URL_APP}`);
  console.log(`  Données : ${dataDir}`);
  console.log('  Pour arrêter : Paramètres → « Arrêter l’application », ou fermez cette fenêtre.\n');
  backup();
  setInterval(backup, 6 * 3600 * 1000).unref();
  // Documents archivés avant la V2 : extraction du texte en tâche de fond ; scans : OCR.
  app.locals
    .reindexMissing()
    .then((n) => n && console.log(`  ${n} document(s) indexé(s) pour la recherche plein texte.`))
    .catch((e) => console.warn('Indexation des documents interrompue :', e.message));
  // Indices de prix (BT, TP…) : récupération automatique dès leur publication par l'INSEE.
  app.locals.startIndexWatch();
  openWindow();
});

server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') {
    console.error(e);
    process.exit(1);
  }
  // Port occupé : on dit quelle installation de Clausia l'occupe (ou qu'il s'agit d'un autre programme).
  fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json())
    .then((h) => {
      if (h.app !== 'contrats-app') throw new Error('autre programme');
      const same = path.resolve(h.root ?? '') === path.resolve(import.meta.dirname, '..');
      console.error(same
        ? `  Clausia ${h.version} tourne déjà depuis ce dossier : ouvrez ${URL_APP}`
        : `  Une AUTRE installation de Clausia (version ${h.version ?? 'ancienne'}) occupe le port ${PORT}.\n  Dossier : ${h.root ?? 'inconnu (version antérieure à 5.0.6)'}\n  Données : ${h.data_dir ?? 'inconnues'} (${h.contracts ?? '?'} contrat(s))\n  Arrêtez-la (Paramètres → Arrêter l'application, ou Gestionnaire des tâches → Node.js → Fin de tâche), puis relancez.`);
    })
    .catch(() => console.error(`  Le port ${PORT} est déjà utilisé par un autre programme. Fermez-le ou lancez avec PORT=4581.`))
    .finally(() => process.exit(1));
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
