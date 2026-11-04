import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { addDays, today } from './deadlines.js';
import { parseMonth, parseSdmx, refreshIndices, shiftMonth } from './revision.js';

let server;
let base;
let dataDir;
let app;
let db;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contrats-v6-'));
  db = openDatabase(dataDir);
  app = createApp({ db, dataDir });
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

const api = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (res.status >= 400) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
};

test('FIDIC : référentiel, délais de claims, paiement à 56 jours, forclusion', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Water plant', framework: 'FIDIC_YELLOW_2017', status: 'actif', start_date: addDays(today(), -10), currency: 'USD' });
  const rules = await api('GET', `/api/contracts/${c.id}/legal`);
  assert.ok(rules.some((r) => r.title === 'Notice of Claim' && /28 jours/.test(r.value) && r.source.includes('20.2.1')));
  assert.ok(rules.some((r) => r.theme === 'Conception'), 'Yellow Book : revue des Contractor’s Documents');

  const awareness = addDays(today(), -30);
  const cl = await api('POST', '/api/claims', { contract_id: c.id, title: 'Unforeseeable ground conditions', dispute_date: awareness });
  assert.equal(cl.computed_notice_due, addDays(awareness, 28));
  assert.equal(cl.computed_memo_due, addDays(awareness, 84));
  const insights = (await api('GET', `/api/insights?contract_id=${c.id}`)).map((i) => i.title).join('\n');
  assert.match(insights, /délai de Notice of Claim dépassé/);
  assert.match(insights, /Pièces de référence manquantes : Contrat, Particular Conditions, Specification \/ Employer’s Requirements/);
  const dl = await api('GET', `/api/deadlines?contract_id=${c.id}`);
  assert.ok(dl.some((d) => /Programme initial à soumettre/.test(d.title) && d.date === addDays(c.start_date, 28)));

  // Particular Conditions : délai de notice porté à 42 jours.
  await api('PUT', `/api/contracts/${c.id}`, { fidic_notice_days: 42 });
  assert.equal((await api('GET', `/api/claims/${cl.id}`)).computed_notice_due, addDays(awareness, 42));

  const pay = await api('POST', '/api/payments', { contract_id: c.id, submitted_date: '2026-09-01', amount_requested: 1000 });
  assert.equal(pay.computed_due_date, addDays('2026-09-01', 56));
});

test('accord-cadre : bons de commande, consommation et alertes', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Maintenance réseaux', framework: 'FR_PUBLIC', buyer_type: 'etat', status: 'actif', agreement_type: 'bons_commande', min_amount: 100000, max_amount: 500000, start_date: '2026-01-01', end_date: '2031-01-01' });
  const bc1 = await api('POST', '/api/orders', { contract_id: c.id, title: 'Lot 1', amount: 250000, due_date: addDays(today(), -3), status: 'en cours' });
  assert.equal(bc1.number, 'BC-001');
  await api('POST', '/api/orders', { contract_id: c.id, title: 'Lot 2', amount: 170000, kind: 'bon de commande' });
  await api('POST', '/api/orders', { contract_id: c.id, title: 'Annulé', amount: 900000, status: 'annulé' });
  const s = await api('GET', `/api/contracts/${c.id}/agreement`);
  assert.equal(s.committed, 420000);
  assert.equal(Math.round(s.consumption_percent), 84);
  const titles = (await api('GET', `/api/insights?contract_id=${c.id}`)).map((i) => i.title).join('\n');
  assert.match(titles, /Accord-cadre consommé à 84 %/);
  assert.match(titles, /Durée de l’accord-cadre supérieure à 4 ans/);
  assert.match(titles, /BC-001 : délai d’exécution dépassé/);
  const ms = await api('POST', '/api/orders', { contract_id: c.id, title: 'Subséquent', kind: 'marché subséquent', amount: 1 });
  assert.equal(ms.number, 'MS-001');
});

test('révision des prix : formule, indices, provisoire puis définitive', async () => {
  assert.equal(parseMonth('septembre 2026'), '2026-09');
  assert.equal(parseMonth('09/2026'), '2026-09');
  assert.equal(parseMonth('sept. 2026'), '2026-09');
  assert.equal(shiftMonth('2026-01', -3), '2025-10');

  const c = await api('POST', '/api/contracts', { title: 'Gymnase', framework: 'FR_PUBLIC', buyer_type: 'etat', status: 'actif' });
  await api('PUT', `/api/contracts/${c.id}`, { rev_enabled: 1, rev_fixed: 0.15, rev_terms: JSON.stringify([{ index: 'BT01', weight: 0.85 }]), rev_base_month: '2025-10', rev_lag_months: 0, rev_decimals: 4 });
  for (const [month, value] of [['2025-10', 130], ['2026-08', 136.5]]) await api('POST', '/api/indices/BT01/values', { month, value: String(value).replace('.', ',') });

  const p1 = await api('POST', '/api/payments', { contract_id: c.id, period: 'août 2026', submitted_date: '2026-09-05', amount_requested: 100000 });
  // Cn = 0,15 + 0,85 × 136,5 / 130 = 1,0425
  assert.equal(p1.revision.coefficient, 1.0425);
  assert.equal(p1.revision.amount, 4250);
  assert.equal(p1.revision.status, 'définitive');

  const p2 = await api('POST', '/api/payments', { contract_id: c.id, period: 'septembre 2026', amount_requested: 50000 });
  assert.equal(p2.revision.status, 'provisoire', 'indice de septembre pas encore publié : dernier connu');
  let titles = (await api('GET', `/api/insights?contract_id=${c.id}`)).map((i) => i.title).join('\n');
  assert.match(titles, /1 révision\(s\) provisoire\(s\)/);

  // Publication INSEE simulée (réponse SDMX), récupération automatique.
  const sdmx = '<message:StructureSpecificData><Series IDBANK="001710986"><Obs TIME_PERIOD="2026-08" OBS_VALUE="136.5" OBS_QUAL="DEF"/><Obs TIME_PERIOD="2026-09" OBS_VALUE="137.8" OBS_QUAL="DEF"/></Series></message:StructureSpecificData>';
  assert.deepEqual(parseSdmx(sdmx).map((o) => o.month), ['2026-08', '2026-09']);
  const calls = [];
  const fetchImpl = async (url) => (calls.push(url), { ok: true, text: async () => sdmx });
  const res = await refreshIndices(db, { codes: ['BT01'], fetchImpl });
  assert.deepEqual(res[0].added, ['2026-09']);
  assert.match(calls[0], /SERIES_BDM\/001710986/);
  const p2b = await api('GET', `/api/payments/${p2.id}`);
  assert.equal(p2b.revision.status, 'définitive');
  assert.equal(p2b.revision.coefficient, 1.051); // 0,15 + 0,85 × 137,8 / 130 = 1,05100
  titles = (await api('GET', `/api/insights?contract_id=${c.id}`)).map((i) => i.title).join('\n');
  assert.match(titles, /révision définitive calculée/);
  const sum = await api('GET', `/api/contracts/${c.id}/revision`);
  assert.equal(sum.total, 4250 + 2550);
  assert.equal(sum.check.ok, true);

  // Erreur INSEE : consignée sur l'indice, sans casser l'application.
  const err = await refreshIndices(db, { codes: ['BT01'], fetchImpl: async () => ({ ok: false, status: 404, text: async () => '' }) });
  assert.match(err[0].error, /INSEE injoignable ou identifiant inconnu/);
  assert.match((await api('GET', '/api/indices')).find((i) => i.code === 'BT01').last_error, /INSEE/);

  // Import CSV au format « large » : Mois ; TP01 ; TP02
  const form = new FormData();
  form.append('files', new Blob(['Mois;TP01;TP02\n10/2025;125,4;118,2\n09/2026;129,9;120,1\n']), 'indices.csv');
  const imp = await (await fetch(`${base}/api/indices/import`, { method: 'POST', body: form })).json();
  assert.equal(imp.imported, 4);
  assert.deepEqual(imp.indices.sort(), ['TP01', 'TP02']);
});

test('analyse d’un contrat déposé à la création', async () => {
  await api('PUT', '/api/ai/mode', { mode: 'off' });
  const { Document, Packer, Paragraph } = await import('docx');
  const lines = [
    'ACTE D’ENGAGEMENT',
    'Pouvoir adjudicateur : Commune de Villeurbanne',
    'Marché n° 2026-TRV-015',
    'Objet du marché : Construction du groupe scolaire Jules Ferry – lot 3 gros œuvre',
    'Le présent accord-cadre à bons de commande est passé en application du Code de la commande publique.',
    'Montant minimum : 200 000,00 € HT ; montant maximum : 1 500 000,00 € HT.',
    'Montant total du marché hors taxes : 1 234 567,89 €',
    'Le CCAG Travaux 2021 est applicable.',
    'Date de commencement : 01/03/2026. Délai d’exécution : 18 mois.',
    'Délai global de paiement : 30 jours. Retenue de garantie : 5 %. Une avance de 10 % est versée.',
    'Pénalités de retard : 1/3000 du montant du marché par jour calendaire de retard.',
    'Révision des prix : Cn = 0,15 + 0,85 × BT01n / BT01o, mois zéro : octobre 2025.',
    'Fait à Lyon, le 15/01/2026',
  ];
  const buf = await Packer.toBuffer(new Document({ sections: [{ children: lines.map((l) => new Paragraph(l)) }] }));
  const form = new FormData();
  form.append('files', new Blob([buf]), 'AE-lot3.docx');
  const out = await (await fetch(`${base}/api/contracts/analyze`, { method: 'POST', body: form })).json();
  const v = out.values;
  assert.equal(out.method, 'règles');
  assert.equal(v.framework, 'FR_PUBLIC');
  assert.equal(v.ccag, 'TRAVAUX_2021');
  assert.equal(v.buyer_type, 'collectivite');
  assert.equal(v.reference, '2026-TRV-015');
  assert.equal(v.title, 'Construction du groupe scolaire Jules Ferry – lot 3 gros œuvre');
  assert.match(v.counterparty, /^Commune de Villeurbanne/);
  assert.equal(v.amount, 1234567.89);
  assert.equal(v.agreement_type, 'bons_commande');
  assert.equal(v.min_amount, 200000);
  assert.equal(v.max_amount, 1500000);
  assert.equal(v.start_date, '2026-03-01');
  assert.equal(v.completion_date, '2027-09-01', 'démarrage + 18 mois');
  assert.equal(v.signature_date, '2026-01-15');
  assert.equal(v.payment_days, 30);
  assert.equal(v.retention_percent, 5);
  assert.equal(v.advance_amount, 123457);
  assert.match(v.penalty_terms, /1\/3000/);
  assert.equal(v.rev_fixed, 0.15);
  assert.deepEqual(JSON.parse(v.rev_terms), [{ index: 'BT01', weight: 0.85 }]);
  assert.equal(v.rev_base_month, '2025-10');
  assert.match(out.sources.amount, /1 234 567,89/);
  const { detectFormula } = await import('./contract-analyze.js');
  const f3 = detectFormula('Cn = 0,125 + 0,875 × TP01n / TP01o');
  assert.equal(f3.rev_fixed, 0.125);
  assert.deepEqual(JSON.parse(f3.rev_terms), [{ index: 'TP01', weight: 0.875 }]);

  // FIDIC en anglais.
  const fidic = new FormData();
  fidic.append('files', new Blob([Buffer.from('Contract Agreement – FIDIC Conditions of Contract for Plant and Design-Build, Yellow Book 2017\nThe Employer: Water Authority of Oran\nAccepted Contract Amount: USD 12,500,000.00\nCommencement Date: 2026-05-04')]), 'contract.txt');
  const f = (await (await fetch(`${base}/api/contracts/analyze`, { method: 'POST', body: fidic })).json()).values;
  assert.equal(f.framework, 'FIDIC_YELLOW_2017');
  assert.equal(f.currency, 'USD');
  assert.equal(f.amount, 12500000);
  assert.equal(f.start_date, '2026-05-04');
  await api('PUT', '/api/ai/mode', { mode: 'ollama' });
});

test('correspondance : classement automatique par thème et criticité', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Tunnel', framework: 'FR_PUBLIC', status: 'actif' });
  const { Document, Packer, Paragraph } = await import('docx');
  const letter = await Packer.toBuffer(new Document({ sections: [{ children: ['Paris, le 03/11/2026', 'Objet : Mise en demeure de reprendre les travaux', 'Faute de reprise sous 8 jours, des pénalités seront appliquées.'].map((l) => new Paragraph(l)) }] }));
  const form = new FormData();
  form.append('contract_id', String(c.id));
  form.append('files', new Blob([letter]), 'courrier MOA.docx');
  form.append('files', new Blob([Buffer.from('%PDF-1.4')]), 'CR réunion de chantier n°12.pdf');
  const [m1, m2] = await (await fetch(`${base}/api/correspondence/import`, { method: 'POST', body: form })).json();
  assert.equal(m1.subject, 'Mise en demeure de reprendre les travaux');
  assert.equal(m1.date, '2026-11-03');
  assert.equal(m1.type, 'Mise en demeure');
  assert.equal(m1.theme, 'Mise en demeure / pénalités');
  assert.equal(m1.criticality, 'critique');
  assert.equal(m2.theme, 'Réunion / compte rendu');
  assert.equal(m2.criticality, 'faible');

  // Saisie manuelle : classement recalculé quand l'objet change…
  const m3 = await api('POST', '/api/correspondence', { contract_id: c.id, direction: 'entrant', subject: 'Transmission du planning', date: '2026-11-01' });
  assert.equal(m3.theme, 'Délais / planning');
  const m3b = await api('PUT', `/api/correspondence/${m3.id}`, { subject: 'Réserves sur le décompte' });
  assert.equal(m3b.theme, 'Paiement / facturation');
  assert.equal(m3b.criticality, 'haute');
  // … mais un choix manuel n'est plus écrasé.
  await api('PUT', `/api/correspondence/${m3.id}`, { theme: 'Administratif', criticality: 'faible' });
  const m3c = await api('PUT', `/api/correspondence/${m3.id}`, { subject: 'Réclamation urgente' });
  assert.equal(m3c.theme, 'Administratif');
  assert.equal(m3c.criticality, 'faible');
});

test('imports : WBS (Excel, Word), visas, analyse de document par l’assistant', async () => {
  await api('PUT', '/api/ai/mode', { mode: 'off' });
  const c = await api('POST', '/api/contracts', { title: 'Station', framework: 'FR_PUBLIC', status: 'actif' });
  const post = async (url, name, buffer, fields = {}) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    form.append('files', new Blob([buffer]), name);
    const res = await fetch(base + url, { method: 'POST', body: form });
    return { status: res.status, data: await res.json() };
  };
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('WBS').addRows([['Code WBS', 'Libellé', 'Budget', 'Responsable'], ['1', 'Génie civil', '1 200 000', 'Lot GC'], ['1.1', 'Terrassements', 300000, ''], ['1.2', 'Fondations', 450000, '']]);
  const r1 = await post(`/api/contracts/${c.id}/wbs/import`, 'wbs.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
  assert.deepEqual([r1.data.created, r1.data.updated, r1.data.source], [3, 0, 'tableau']);
  const { Document, Packer, Paragraph } = await import('docx');
  const doc = await Packer.toBuffer(new Document({ sections: [{ children: ['Structure de découpage', '1.2 Fondations profondes', '1.2.1 Pieux forés', '2 Équipements', '2.1 Pompes'].map((l) => new Paragraph(l)) }] }));
  const r2 = await post(`/api/contracts/${c.id}/wbs/import`, 'wbs.docx', doc);
  assert.deepEqual([r2.data.created, r2.data.updated], [3, 1]);
  const wbs = await api('GET', `/api/wbs_items?contract_id=${c.id}`);
  assert.equal(wbs.find((w) => w.code === '1.2').title, 'Fondations profondes');
  assert.equal(wbs.find((w) => w.code === '1.2.1').parent_code, '1.2');
  assert.equal(wbs.find((w) => w.code === '1').budget, 1200000);
  assert.equal((await post(`/api/contracts/${c.id}/wbs/import`, 'note.txt', Buffer.from('Simple texte sans codes'))).status, 400);

  const [v] = (await post('/api/submittals/import-documents', 'PN1210D_06_ACT_STF_001306_4 Spécification fonctionnelle.pdf', Buffer.from('%PDF-1.4'), { contract_id: c.id })).data;
  assert.equal(v.number, 'PN1210D_06_ACT_STF_001306');
  assert.equal(v.revision, '4');
  assert.equal(v.title, 'Spécification fonctionnelle');
  assert.equal(v.visa_status, 'en attente');
  assert.ok(v.computed_visa_due);

  const letter = await Packer.toBuffer(new Document({ sections: [{ children: ['Lyon, le 02/11/2026', 'Objet : Réserves sur l’ordre de service n°7', 'Nous émettons des réserves pour un montant de 45 000,00 € et 10 jours de délai.'].map((l) => new Paragraph(l)) }] }));
  const r3 = (await post(`/api/contracts/${c.id}/ai/analyze-file`, 'reserves-OS7.docx', letter)).data;
  assert.equal(r3.analysis.provider, 'règles');
  assert.equal(r3.document.category, 'Ordre de service');
  assert.match(r3.analysis.key_points.join(' '), /45\s000,00\s€/);
  assert.equal(r3.analysis.risks[0].level, 'élevé');
  assert.match(r3.ai_error, /désactivé/);
  await api('PUT', '/api/ai/mode', { mode: 'ollama' });
});

test('courriers FIDIC en anglais (2017 et 1999)', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Desalination plant', reference: 'DP-01', framework: 'FIDIC_YELLOW_2017', status: 'actif', currency: 'USD' });
  const cl = await api('POST', '/api/claims', { contract_id: c.id, title: 'Unforeseeable physical conditions', dispute_date: '2026-10-10', amount_claimed: 250000, extra_days_claimed: 30 });
  const n = await api('POST', '/api/letters/preview', { contract_id: c.id, template: 'fidic_notice_of_claim', entity_id: cl.id });
  assert.equal(n.lang, 'en');
  assert.deepEqual(n.languages, ['fr', 'en']);
  assert.equal(n.subject, 'Notice of Claim REC-001 – Unforeseeable physical conditions');
  assert.match(n.body, /Sub-Clause 20\.2\.1 of the Conditions of Contract/);
  assert.match(n.body, /10 October 2026/);
  assert.match(n.body, /expiring on 7 November 2026/);
  assert.match(n.body, /\$250,000\.00/);
  const fr = await api('POST', '/api/letters/preview', { contract_id: c.id, template: 'fidic_notice_of_claim', entity_id: cl.id, lang: 'fr' });
  assert.match(fr.body, /clause 20\.2\.1/);
  await api('PUT', `/api/claims/${cl.id}`, { response_date: '2026-12-01', decision: 'Claim rejected' });
  const nod = await api('POST', '/api/letters/preview', { contract_id: c.id, template: 'fidic_nod', entity_id: cl.id });
  assert.match(nod.body, /Sub-Clause 3\.7\.5/);
  assert.match(nod.body, /Determination disputed: Claim rejected/);
  const gen = await api('POST', '/api/letters/generate', { contract_id: c.id, template: 'fidic_nod', entity_id: cl.id, ...nod });
  assert.ok(gen.document.id);
  const templates = await api('GET', `/api/letters/templates?contract_id=${c.id}`);
  assert.ok(templates.some((t) => t.id === 'fidic_advance_warning'));

  const old = await api('POST', '/api/contracts', { title: 'Road', framework: 'FIDIC_RED_1999', status: 'actif' });
  const cl2 = await api('POST', '/api/claims', { contract_id: old.id, title: 'Late possession', dispute_date: '2026-10-01', notice_date: '2026-10-20' });
  const d = await api('POST', '/api/letters/preview', { contract_id: old.id, template: 'fidic_detailed_claim', entity_id: cl2.id });
  assert.match(d.body, /Sub-Clause 20\.1 of the Contract/);
  assert.match(d.body, /Sub-Clause 3\.5 to agree or determine/);
  assert.ok(!(await api('GET', `/api/letters/templates?contract_id=${old.id}`)).some((t) => t.id === 'fidic_nod'), 'NOD : édition 2017 seulement');
  const ins = await api('GET', `/api/insights?contract_id=${c.id}`);
  assert.ok(ins.some((i) => i.letter === 'fidic_notice_of_claim'));
});
