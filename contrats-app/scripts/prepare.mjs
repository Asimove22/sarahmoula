// Prépare l'application avant lancement : installe les composants et reconstruit l'interface
// uniquement si nécessaire (premier lancement ou mise à jour). Usage : node scripts/prepare.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const checkOnly = process.argv.includes('--check');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const hashFiles = (files) => {
  const h = crypto.createHash('sha1');
  for (const f of files) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) h.update(f).update(fs.readFileSync(p));
  }
  return h.digest('hex');
};
const walk = (dir) =>
  fs.existsSync(path.join(root, dir))
    ? fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    : [];
const read = (f) => (fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : '');

const depsHash = hashFiles(['package.json', 'package-lock.json']);
const depsStamp = 'node_modules/.contrats-deps';
const needInstall = !fs.existsSync(path.join(root, 'node_modules')) || read(depsStamp) !== depsHash;

const uiFiles = ['index.html', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js', 'package.json', ...walk('src'), ...walk('public')].sort();
const uiHash = hashFiles(uiFiles);
const uiStamp = 'dist/.contrats-build';
const needBuild = !fs.existsSync(path.join(root, 'dist', 'index.html')) || read(uiStamp) !== uiHash;

if (checkOnly) process.exit(needInstall || needBuild ? 10 : 0);

const run = (args, label) => {
  console.log(label);
  const r = spawnSync(npm, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n  Échec : ${npm} ${args.join(' ')}`);
    process.exit(r.status || 1);
  }
};

if (needInstall) {
  run(['install', '--no-audit', '--no-fund', '--loglevel=error'], 'Installation des composants (premier lancement ou mise à jour : 1 à 3 minutes)…');
  // npm peut réécrire package-lock.json : l'empreinte est recalculée après l'installation.
  fs.writeFileSync(path.join(root, depsStamp), hashFiles(['package.json', 'package-lock.json']));
}
if (needBuild || needInstall) {
  run(['run', 'build', '--silent'], 'Préparation de l’interface…');
  fs.writeFileSync(path.join(root, uiStamp), hashFiles(uiFiles));
}
