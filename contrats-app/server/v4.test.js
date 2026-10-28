import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mammoth from 'mammoth';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { addDays, today } from './deadlines.js';
import { addMonths, lateInterest } from './legal.js';

let server;
let base;
let dataDir;
let app;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contrats-v4-'));
  app = createApp({ db: openDatabase(dataDir), dataDir });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await app.locals.ocr.close();
  server.closeAllConnections();
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const call = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
};
const api = async (method, url, body) => {
  const { status, data } = await call(method, url, body);
  if (status >= 400) throw new Error(`${method} ${url} → ${status} ${JSON.stringify(data)}`);
  return data;
};

test('calculs : intérêts moratoires et ajout de mois', () => {
  const r = lateInterest({ amount: 100000, dueDate: addDays(today(), -30), ecbRate: 2 });
  assert.equal(r.days, 30);
  assert.equal(r.rate, 10);
  assert.equal(r.interest, 821.92);
  assert.equal(r.flat_fee, 40);
  assert.equal(lateInterest({ amount: 100000, dueDate: addDays(today(), -30) }).interest, null, 'sans taux BCE : pas de montant inventé');
  assert.equal(lateInterest({ amount: 100, dueDate: addDays(today(), 3) }), null);
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-03-15', 2), '2026-05-15');
});

test('marché public de travaux : référentiel, échéances, points d’attention, courriers', async () => {
  const c = await api('POST', '/api/contracts', {
    title: 'Pont de la Saône', reference: 'MP-77', framework: 'FR_PUBLIC', ccag: 'TRAVAUX_2021', buyer_type: 'sante', status: 'actif',
    amount: 3_000_000, start_date: '2026-01-01', completion_date: '2027-06-30', retention_percent: 6, payment_days: 60,
  });

  const rules = await api('GET', `/api/contracts/${c.id}/legal`);
  const pay = rules.find((r) => r.title === 'Délai global de paiement');
  assert.match(pay.value, /^50 jours/);
  assert.match(pay.source, /R2192-10/);
  assert.ok(rules.some((r) => r.theme === 'Pénalités' && r.verify));
  assert.ok(rules.some((r) => r.source.includes('R2193-10')));

  // Paiement : délai légal de 50 jours pour un établissement public de santé quand le contrat n'en fixe pas.
  await api('PUT', `/api/contracts/${c.id}`, { payment_days: null });
  const sit = await api('POST', '/api/payments', { contract_id: c.id, submitted_date: addDays(today(), -80), amount_validated: 200000 });
  assert.equal(sit.computed_due_date, addDays(today(), -30));
  assert.equal(sit.late_interest.days, 30);
  assert.equal(sit.late_interest.interest, null);
  await api('PUT', '/api/settings', { ecb_rate: '2' });
  const sit2 = await api('GET', `/api/payments/${sit.id}`);
  assert.equal(sit2.late_interest.interest, 1643.84);
  const reminder = await api('POST', '/api/letters/preview', { contract_id: c.id, template: 'payment_reminder', entity_id: sit.id });
  assert.match(reminder.body, /R2192-31/);
  assert.match(reminder.body.replace(/\s/g, ' '), /1 643,84/);

  // Ordre de service : réserves sous 15 jours.
  const os1 = await api('POST', '/api/service_orders', { contract_id: c.id, title: 'Modification du phasage', received_date: addDays(today(), -12), amount: 45000, extra_days: 10 });
  assert.equal(os1.number, 'OS-001');
  assert.equal(os1.computed_reserves_due, addDays(today(), 3));
  const letter = await api('POST', '/api/letters/preview', { contract_id: c.id, template: 'os_reserves', entity_id: os1.id });
  assert.match(letter.body, /quinze jours/);

  // Différend : mémoire en réclamation sous 2 mois.
  const cl = await api('POST', '/api/claims', { contract_id: c.id, title: 'Sujétions imprévues fondations', dispute_date: '2026-09-15', amount_claimed: 120000 });
  assert.equal(cl.computed_memo_due, '2026-11-15');

  // Sous-traitant non agréé et sans paiement direct.
  const st = await api('POST', '/api/subcontractors', { contract_id: c.id, company: 'Forages SA', amount_ht: 80000, direct_payment: 0 });
  assert.equal(st.direct_payment_required, true);

  // Avenants : +20 % cumulés (> 15 % travaux) dont un > 50 % ? non ; puis un avenant > 50 %.
  await api('POST', '/api/amendments', { contract_id: c.id, title: 'Avenant 1', amount: 600000, status: 'signé' });
  await api('POST', '/api/amendments', { contract_id: c.id, title: 'Avenant 2 (projet)', amount: 1_600_000, status: 'en négociation' });

  // Planning en retard de 31 jours → pénalités théoriques 1/3000 par jour.
  const form = new FormData();
  form.append('file', new Blob(['ID;Nom;Début;Fin\n1;Travaux;01/01/2026;31/07/2027\n']), 'p.csv');
  await fetch(`${base}/api/contracts/${c.id}/schedule/import`, { method: 'POST', body: form });

  const deadlines = await api('GET', `/api/deadlines?contract_id=${c.id}`);
  assert.ok(deadlines.some((d) => d.entity === 'service_orders' && d.date === addDays(today(), 3)));
  assert.ok(deadlines.some((d) => d.entity === 'claims' && d.date === '2026-11-15'));

  const insights = await api('GET', `/api/insights?contract_id=${c.id}`);
  const titles = insights.map((i) => i.title).join('\n');
  assert.match(titles, /Retenue de garantie de 6 % : au-delà du plafond légal de 5 %/);
  assert.match(titles, /Avenants cumulés : \+20\.0 %/);
  assert.match(titles, /Avenant AV-002 supérieur à 50 %/);
  assert.match(titles, /Sous-traitant Forages SA non agréé/);
  assert.match(titles, /Paiement direct obligatoire pour Forages SA/);
  assert.match(titles, /OS-001 : réserves à émettre avant le/);
  assert.match(titles.replace(/\s/g, ' '), /Pénalités théoriques : 31 000 € pour 31 j de retard/);
  assert.equal(insights.find((i) => /OS-001/.test(i.title)).letter, 'os_reserves');

  // Décompte : DGD notifié → 30 jours pour le retourner signé.
  await api('PUT', `/api/contracts/${c.id}`, { reception_date: addDays(today(), -40), dgd_notified_date: addDays(today(), -10) });
  const d2 = await api('GET', `/api/deadlines?contract_id=${c.id}`);
  assert.ok(d2.some((d) => /décompte général signé/.test(d.title) && d.date === addDays(today(), 20)));
  assert.ok(d2.some((d) => /projet de décompte final/.test(d.title) && d.overdue));

  // Check-list de revue propre au CCAG Travaux.
  await api('POST', `/api/contracts/${c.id}/review/template`);
  const themes = (await api('GET', `/api/review_items?contract_id=${c.id}`)).map((r) => r.theme);
  assert.ok(themes.includes('Ordres de service') && themes.includes('Décompte') && themes.includes('Retenue de garantie'));
});

test('bascule de l’IA : moteur global et moteur imposé par contrat', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Confidentiel', framework: 'FR_PUBLIC' });
  let r = await call('PUT', '/api/ai/mode', { mode: 'nimporte' });
  assert.equal(r.status, 400);
  const st = await api('PUT', '/api/ai/mode', { mode: 'claude' });
  assert.equal(st.mode, 'claude');
  assert.equal(st.claude.configured, false);
  assert.equal(st.ollama.ok, false);
  r = await call('POST', '/api/ai/ask', { contract_id: c.id, question: 'test' });
  assert.match(r.data.error, /Claude est sélectionné, mais aucune clé API/);
  assert.equal((await api('GET', `/api/contracts/${c.id}`)).ai_effective, 'claude');
  // Le contrat impose le local : Ollama (ici injoignable) est utilisé malgré le choix global.
  await api('PUT', '/api/settings', { ollama_url: 'http://127.0.0.1:9' });
  await api('PUT', `/api/contracts/${c.id}`, { ai_provider: 'ollama' });
  assert.equal((await api('GET', `/api/contracts/${c.id}`)).ai_effective, 'ollama');
  r = await call('POST', '/api/ai/ask', { contract_id: c.id, question: 'test' });
  assert.match(r.data.error, /Ollama ne répond pas/);
  await api('PUT', '/api/ai/mode', { mode: 'off' });
  await api('PUT', `/api/contracts/${c.id}`, { ai_provider: null });
  r = await call('POST', '/api/ai/ask', { contract_id: c.id, question: 'test' });
  assert.match(r.data.error, /désactivé/);
});

test('courriers NEC en anglais', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Water treatment works', reference: 'ECC-9', framework: 'NEC4', currency: 'GBP' });
  const ew = await api('POST', '/api/early_warnings', { contract_id: c.id, title: 'Unexpected ground conditions', affects_price: 1, affects_completion: 1, next_review_date: '2026-11-10' });
  const prev = await api('POST', '/api/letters/preview', { contract_id: c.id, template: 'ew_notification', entity_id: ew.id });
  assert.equal(prev.lang, 'en');
  assert.deepEqual(prev.languages, ['fr', 'en']);
  assert.equal(prev.subject, 'Early warning EW-001 – Unexpected ground conditions');
  assert.match(prev.body, /could increase the total of the Prices, delay Completion/);
  assert.match(prev.body, /10 November 2026/);
  const fr = await api('POST', '/api/letters/preview', { contract_id: c.id, template: 'ew_notification', entity_id: ew.id, lang: 'fr' });
  assert.match(fr.subject, /^Notification d'Early Warning/);
  const gen = await api('POST', '/api/letters/generate', { contract_id: c.id, template: 'ew_notification', entity_id: ew.id, ...prev });
  const docx = (await call('GET', `/api/documents/${gen.document.id}/file`)).data;
  const text = (await mammoth.extractRawText({ buffer: docx })).value;
  assert.match(text, /Dear Sir or Madam,/);
  assert.match(text, /Subject: Early warning EW-001/);
  assert.match(text, /Yours faithfully,/);
  const templates = await api('GET', `/api/letters/templates?contract_id=${c.id}`);
  assert.equal(templates.find((t) => t.id === 'ce_quotation').label_en, 'Quotation for a compensation event (cl. 62)');
});

test('KPI : agrégats par thématique', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Tramway', framework: 'NEC4', status: 'actif', amount: 1_000_000, completion_date: '2027-01-31' });
  await api('POST', '/api/payments', { contract_id: c.id, amount_validated: 300000, amount_paid: 200000, submitted_date: '2026-09-01', paid_date: '2026-10-01' });
  await api('POST', '/api/review_items', { contract_id: c.id, theme: 'Pénalités', risk_level: 'critique' });
  await api('POST', '/api/review_items', { contract_id: c.id, theme: 'Pénalités', risk_level: 'faible' });
  await api('POST', '/api/early_warnings', { contract_id: c.id, title: 'Réseaux', date_notified: `${today().slice(0, 7)}-01` });
  await api('POST', '/api/submittals', { contract_id: c.id, title: 'Plan de coffrage', visa_due: addDays(today(), -2) });
  const k = await api('GET', `/api/kpis?contract_id=${c.id}`);
  assert.equal(k.tiles.active_contracts, 1);
  assert.equal(k.tiles.high_risks, 1);
  assert.equal(k.tiles.late_visas, 1);
  assert.deepEqual(k.finance[0], { ...k.finance[0], current: 1_000_000, paid: 200000, outstanding: 100000, remaining: 700000 });
  assert.deepEqual(k.risks[0], { theme: 'Pénalités', faible: 1, moyen: 0, élevé: 0, critique: 1, non_évalué: 0, total: 2 });
  assert.equal(k.monthly.length, 12);
  assert.equal(k.monthly.at(-1).ew, 1);
  assert.equal(k.deadlines[0].month, 'overdue');
  assert.equal(k.visas.find((v) => v.status === 'en attente').count, 1);
  assert.equal((await api('GET', '/api/kpis')).finance.length >= 1, true);
});

test('interface anglaise : points d’attention et échéances traduits', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Depot', framework: 'FR_PUBLIC', ccag: 'TRAVAUX_2021', buyer_type: 'etat', status: 'actif', retention_percent: 7 });
  await api('POST', '/api/service_orders', { contract_id: c.id, number: 'OS-9', title: 'Phasage', received_date: addDays(today(), -12) });
  const get = async (url) => (await fetch(base + url, { headers: { 'X-Lang': 'en' } })).json();
  const ins = (await get(`/api/insights?contract_id=${c.id}`)).map((i) => i.title).join('\n');
  assert.match(ins, /Retention of 7 %: above the statutory 5 % cap/);
  assert.match(ins, /Service order OS-9: reservations to issue before/);
  assert.doesNotMatch(ins, /Retenue de garantie de/);
  const dl = await get(`/api/deadlines?contract_id=${c.id}`);
  assert.ok(dl.some((d) => d.title === 'Reservations on service order OS-9: Phasage' && d.kind === 'marché public'));
  const fr = await api('GET', `/api/insights?contract_id=${c.id}`);
  assert.ok(fr.some((i) => /^Retenue de garantie de 7 %/.test(i.title)));
});

test('Ollama : nom de modèle tolérant et variante de la même famille', async () => {
  const { pickOllamaModel } = await import('./ai.js');
  assert.deepEqual(pickOllamaModel('qwen2.5:7b', ['qwen2.5:7b', 'llama3:8b']), { name: 'qwen2.5:7b', exact: true });
  assert.deepEqual(pickOllamaModel('Qwen 2.5:7B', ['qwen2.5:7b']), { name: 'qwen2.5:7b', exact: true });
  assert.deepEqual(pickOllamaModel('qwen2.5', ['qwen2.5:latest']), { name: 'qwen2.5:latest', exact: true });
  assert.deepEqual(pickOllamaModel('qwen2.5:7b', ['qwen2.5:14b', 'qwen2.5:latest']), { name: 'qwen2.5:latest', exact: false });
  assert.equal(pickOllamaModel('qwen2.5:7b', ['llama3:8b']), null);
  assert.equal(pickOllamaModel('qwen2.5:7b', []), null);
});
