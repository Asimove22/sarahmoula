import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { autoBackup } from './backup.js';
import { normalizeRaci, normalizeRisk } from './imports.js';

let server;
let base;
let dataDir;
let app;
let db;
let ollama;
let aiCalls = 0;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contrats-v3-'));
  db = openDatabase(dataDir);
  app = createApp({ db, dataDir });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  // Faux Ollama pour la veille de revue : propose de relever le risque du point « Pénalités ».
  ollama = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      // Comme le vrai Ollama : liste des modèles installés.
      if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'qwen2.5:7b' }] }));
      aiCalls += 1;
      const payload = JSON.parse(body);
      const prompt = payload.messages[1].content;
      const id = Number(prompt.match(/#(\d+) \| Pénalités/)?.[1] ?? 0);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: { content: JSON.stringify({
        updates: id ? [{ review_item_id: id, note: 'Le retard annoncé expose au plafond de pénalités.', risk_level: 'critique', status: 'à négocier', mitigation: 'Demander une prolongation de délai', rationale: 'Retard probable' }, { review_item_id: 99999, note: 'id inconnu', risk_level: '', status: '', mitigation: '', rationale: '' }] : [],
        new_items: [],
      }) } }));
    });
  });
  ollama.listen(0);
  await new Promise((r) => ollama.once('listening', r));
});

after(async () => {
  await app.locals.ocr.close();
  server.closeAllConnections();
  server.close();
  ollama.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const api = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
};
const send = async (url, fields, file, field = 'file') => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  if (file) form.append(field, new Blob([file.content]), file.name);
  const res = await fetch(base + url, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(`${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
};
async function xlsx(rows, sheetName = 'Feuil1', extraSheet) {
  const wb = new ExcelJS.Workbook();
  if (extraSheet) wb.addWorksheet('Notes').addRow(['Document de travail']);
  const ws = wb.addWorksheet(sheetName);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test('normalisation des risques et des lettres RACI', () => {
  assert.equal(normalizeRisk('Très élevé'), 'critique');
  assert.equal(normalizeRisk('Fort'), 'élevé');
  assert.equal(normalizeRisk('orange'), 'moyen');
  assert.equal(normalizeRisk('3'), 'élevé');
  assert.equal(normalizeRisk('20'), 'critique'); // score P×G sur 25
  assert.equal(normalizeRisk('bof'), null);
  assert.equal(normalizeRisk('4', { score: true }), 'faible');
  assert.equal(normalizeRisk('12', { score: true }), 'élevé');
  assert.equal(normalizeRaci('a, r'), 'R/A');
  assert.equal(normalizeRaci('S'), 'C');
  assert.equal(normalizeRaci(''), '');
});

test('import : une colonne de cotation P×G est lue comme une note sur 25', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Cotation', framework: 'FR_PUBLIC' });
  const file = await xlsx([['Thème', 'Criticité (P×G)'], ['Pénalités', '12'], ['Paiement', '4'], ['Résiliation', '20']]);
  const p = await send(`/api/contracts/${c.id}/import/review/preview`, {}, { name: 'pxg.xlsx', content: file });
  assert.deepEqual(p.items.map((i) => i.risk_level), ['élevé', 'faible', 'critique']);
  assert.match(p.warnings.join(' '), /probabilité × gravité/);
});

test('OCR d’un PDF scanné : texte reconnu, indexé et cherchable', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Marché scanné', framework: 'FR_PUBLIC' });
  const [doc] = await send('/api/documents/upload', { contract_id: String(c.id), category: 'CCAP' }, { name: 'CCAP signé (scan).pdf', content: fs.readFileSync(new URL('./fixtures/scan.pdf', import.meta.url)) }, 'files');
  assert.equal(doc.text_status, 'ocr en attente');
  await app.locals.ocr.idle();
  const row = db.prepare('SELECT text_status, ocr_confidence, content_text FROM documents WHERE id = ?').get(doc.id);
  assert.equal(row.text_status, 'ocr');
  assert.ok(row.ocr_confidence > 70, `confiance ${row.ocr_confidence}`);
  assert.match(row.content_text, /PÉNALITÉS DE RETARD/);
  const hits = await api('GET', '/api/search?q=penalite%20plafond');
  assert.ok(hits.some((h) => h.kind === 'documents' && h.id === doc.id), 'trouvé par la recherche plein texte');
});

test('imports Excel (revue, communication, RACI), exports et veille de revue', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Lot 4', reference: 'MP-44', framework: 'FR_PUBLIC', completion_date: '2027-06-30' });

  // Revue : ligne de titre au-dessus des en-têtes, intitulés libres, feuille secondaire ignorée.
  const reviewFile = await xlsx([
    ['REVUE DE CONTRAT – LOT 4'],
    ['Thématique', 'Article', 'Analyse', 'Criticité', 'Plan d’action', 'Pilote', 'État'],
    ['Pénalités', 'CCAP 4.3', '1/1000 par jour, plafond 10 %', 'Fort', 'Suivi du chemin critique', 'DP', 'Analysé'],
    ['Révision des prix', 'CCAP 3.4', 'Index TP01', 'Moyen', '', '', ''],
    ['Garanties', 'CCAP 8', 'Retenue 5 %', 'xx', '', '', ''],
  ], 'Revue', true);
  const preview = await send(`/api/contracts/${c.id}/import/review/preview`, {}, { name: 'revue.xlsx', content: reviewFile });
  assert.equal(preview.sheet, 'Revue');
  assert.equal(preview.header_row, 2);
  assert.equal(preview.total, 3);
  assert.deepEqual(preview.columns.map((x) => x.field), ['theme', 'clause_ref', 'content', 'risk_level', 'mitigation', 'owner', 'status']);
  assert.match(preview.warnings.join(' '), /1 niveau\(x\) de risque non reconnu/);
  const imp = await send(`/api/contracts/${c.id}/import/review`, { mode: 'ajouter' }, { name: 'revue.xlsx', content: reviewFile });
  assert.equal(imp.created, 3);
  const items = await api('GET', `/api/review_items?contract_id=${c.id}`);
  const pen = items.find((i) => i.theme === 'Pénalités');
  assert.equal(pen.risk_level, 'élevé');
  assert.equal(pen.status, 'analysé');
  assert.match(pen.history, /import Excel/);
  // Réimport : mise à jour au lieu de doublon.
  const again = await send(`/api/contracts/${c.id}/import/review`, {}, { name: 'revue.xlsx', content: reviewFile });
  assert.equal(again.updated, 3);
  assert.equal((await api('GET', `/api/review_items?contract_id=${c.id}`)).length, 3);
  const docs = await api('GET', `/api/documents?contract_id=${c.id}&category=${encodeURIComponent('Revue de contrat')}`);
  assert.equal(docs.length, 1, 'fichier source archivé (versions regroupées)');

  // Matrice de communication en CSV.
  const csv = 'Information;Émetteur;Destinataires;Copie;Canal;Délai (j);Clause\nNotification des réserves;Titulaire;MOE;MOA;LRAR;15;CCAG 41\n';
  assert.equal((await send(`/api/contracts/${c.id}/import/communication`, {}, { name: 'com.csv', content: csv })).created, 1);
  const rule = (await api('GET', `/api/communication_rules?contract_id=${c.id}`))[0];
  assert.equal(rule.recipients, 'MOE');
  assert.equal(rule.delay_days, 15);

  // RACI : intervenants créés à partir des colonnes.
  await api('POST', '/api/stakeholders', { contract_id: c.id, name: 'J. Martin', organisation: 'MOE Ingénierie' });
  const raciFile = await xlsx([
    ['Code', 'Activité', 'Titulaire', 'MOE Ingénierie', 'Bureau de contrôle (Socotec)'],
    ['1.1', 'Viser les plans EXE', 'R', 'A', 'C'],
    ['1.2', 'Réceptionner les travaux', 'I', 'R/A', ''],
  ]);
  const raci = await send(`/api/contracts/${c.id}/import/raci`, {}, { name: 'raci.xlsx', content: raciFile });
  assert.equal(raci.created, 2);
  assert.equal(raci.stakeholders_created, 2, 'MOE Ingénierie reconnu par son organisme');
  const people = await api('GET', `/api/stakeholders?contract_id=${c.id}`);
  assert.ok(people.some((p) => p.name === 'Bureau de contrôle' && p.organisation === 'Socotec'));
  const visa = (await api('GET', `/api/raci_items?contract_id=${c.id}`)).find((r) => r.activity === 'Viser les plans EXE');
  const martin = people.find((p) => p.name === 'J. Martin');
  assert.equal(JSON.parse(visa.assignments)[martin.id], 'A');

  // Exports Excel relisibles par l'import (aller-retour).
  const exported = await api('GET', `/api/contracts/${c.id}/export/raci.xlsx`);
  const back = await send(`/api/contracts/${c.id}/import/raci/preview`, {}, { name: 'export.xlsx', content: exported });
  assert.equal(back.total, 2);
  assert.ok((await api('GET', `/api/contracts/${c.id}/export/review.xlsx`)).length > 1000);
  const tpl = await api('GET', '/api/import-templates/review.xlsx');
  assert.equal((await send(`/api/contracts/${c.id}/import/review/preview`, {}, { name: 'modele.xlsx', content: tpl })).total, 1);
  await assert.rejects(send(`/api/contracts/${c.id}/import/review/preview`, {}, { name: 'ancien.xls', content: 'x' }), /Enregistrer sous/);

  // Veille de revue, règles seules (IA désactivée) : un planning hors délai relève le risque « Pénalités ».
  await api('PUT', '/api/settings', { review_watch_ai: 'off' });
  await send(`/api/contracts/${c.id}/schedule/import`, { name: 'Planning B' }, { name: 'p.csv', content: 'ID;Nom;Début;Fin\n1;Travaux;01/03/2027;31/08/2027\n' });
  await app.locals.watch.idle();
  let props = await api('GET', `/api/review_updates?contract_id=${c.id}&status=${encodeURIComponent('proposée')}`);
  const onPen = props.find((p) => p.item_theme === 'Pénalités');
  assert.ok(onPen, 'proposition sur le point Pénalités');
  assert.equal(JSON.parse(onPen.proposed).risk_level, 'critique');
  assert.equal(JSON.parse(onPen.proposed).status, 'à analyser', 'un point analysé est remis à analyser');
  assert.match(onPen.trigger_label, /62 j après la date contractuelle/);
  assert.ok(!props.some((p) => ['Révision des prix', 'Garanties'].includes(p.item_theme)), 'pas de proposition hors sujet');
  const insights = await api('GET', `/api/insights?contract_id=${c.id}`);
  assert.ok(insights.some((i) => /mise\(s\) à jour de la revue à valider/.test(i.title)));

  await api('POST', `/api/review_updates/${onPen.id}/accept`);
  const penAfter = (await api('GET', `/api/review_items?contract_id=${c.id}`)).find((i) => i.theme === 'Pénalités');
  assert.equal(penAfter.risk_level, 'critique');
  assert.match(penAfter.history.split('\n')[0], /règle · Planning « Planning B »/);
  await assert.rejects(api('POST', `/api/review_updates/${onPen.id}/accept`), /409/);

  // Courrier qui cite l'article d'un point de revue → rapprochement par référence.
  await api('POST', '/api/correspondence', { contract_id: c.id, subject: 'Application de l’article 3.4 du CCAP', summary: 'Le MOE conteste le mois zéro.' });
  await app.locals.watch.idle();
  props = await api('GET', `/api/review_updates?contract_id=${c.id}&status=${encodeURIComponent('proposée')}`);
  assert.ok(props.some((p) => p.item_theme === 'Révision des prix'));
  for (const p of props) await api('POST', `/api/review_updates/${p.id}/reject`);

  // Veille avec IA : l'IA est interrogée, les identifiants inconnus sont ignorés.
  await api('PUT', '/api/settings', { review_watch_ai: 'on', ai_mode: 'ollama', ollama_url: `http://127.0.0.1:${ollama.address().port}` });
  await api('POST', '/api/early_warnings', { contract_id: c.id, title: 'Retard des fondations', affects_completion: 1 });
  await app.locals.watch.idle();
  assert.ok(aiCalls >= 1);
  props = await api('GET', `/api/review_updates?contract_id=${c.id}&status=${encodeURIComponent('proposée')}`);
  const ai = props.filter((p) => p.source === 'IA');
  assert.equal(ai.length, 1);
  assert.equal(JSON.parse(ai[0].proposed).mitigation, 'Demander une prolongation de délai');
  const re = await api('POST', `/api/contracts/${c.id}/review/reanalyze`);
  assert.equal(typeof re.created, 'number');
});

test('sauvegarde automatique quotidienne de la base', () => {
  const first = autoBackup(db, dataDir);
  assert.ok(first && fs.existsSync(first));
  assert.equal(autoBackup(db, dataDir), null, 'une seule par jour');
  const copy = openDatabase(path.join(dataDir, 'verif'));
  copy.close();
});

test('état de l’application', async () => {
  const h = await api('GET', '/api/health');
  assert.equal(h.app, 'contrats-app');
  assert.equal(h.version, JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
});
