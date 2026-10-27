import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Document, Packer, Paragraph } from 'docx';
import mammoth from 'mammoth';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { addDays, today } from './deadlines.js';
import { parseSchedule, parsePredecessors } from './schedule.js';

let server;
let base;
let dataDir;
let ollama;
let ollamaRequests = [];

/** PDF minimal avec une ligne de texte par page (offsets xref exacts). */
function makePdf(lines) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'];
  const stream = `BT /F1 12 Tf 50 800 Td 14 TL ${lines.map((l) => `(${l}) '`).join(' ')} ET`;
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contrats-v2-'));
  const app = createApp({ db: openDatabase(dataDir), dataDir });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;

  // Faux serveur Ollama : renvoie une réponse conforme au schéma demandé.
  ollama = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const payload = JSON.parse(body);
      ollamaRequests.push(payload);
      const props = payload.format?.properties ?? {};
      let content = 'Réponse de test [1]';
      if (props.review_items) {
        content = JSON.stringify({
          summary: 'Marché de génie civil.',
          review_items: [{ theme: 'Pénalités', clause_ref: 'Art. 4.3', content: '1/1000 par jour, sans plafond', risk_level: 'critique', mitigation: 'Négocier un plafond de 10 %' }],
          key_dates: [{ title: 'Achèvement', date: '2027-06-30', clause_ref: 'Art. 5' }, { title: 'Sans date', date: '', clause_ref: '' }],
          obligations: [{ title: 'Notifier les réclamations', clause_ref: 'Art. 50', deadline: '2 mois' }],
        });
      } else if (props.response_required) {
        content = JSON.stringify({ summary: 'Demande de devis.', response_required: true, response_days: 21, actions: ['Chiffrer'], risk: 'compensation_event', risk_reason: 'Modification du phasage' });
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: { role: 'assistant', content } }));
    });
  });
  ollama.listen(0);
  await new Promise((r) => ollama.once('listening', r));
});

after(() => {
  server.closeAllConnections();
  server.close();
  ollama.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const api = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
};
const upload = async (url, fields, fileList, field = 'files') => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  for (const f of fileList) form.append(field, new Blob([f.content]), f.name);
  const res = await fetch(base + url, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(`${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
};

test('analyse des liens de prédécesseurs (formats français et anglais)', () => {
  assert.deepEqual(parsePredecessors('3;5FS+2j;7DD-1;9FF'), [
    { id: '3', type: 'FS', lag_days: 0 },
    { id: '5', type: 'FS', lag_days: 2 },
    { id: '7', type: 'SS', lag_days: -1 },
    { id: '9', type: 'FF', lag_days: 0 },
  ]);
});

test('import Excel/CSV : calcul du chemin critique par passe arrière', async () => {
  const csv = [
    'ID;Nom;Début;Fin;Prédécesseurs',
    '1;Terrassement;01/03/2027;10/03/2027;',
    '2;Fondations;11/03/2027;20/03/2027;1',
    '3;Réseaux (parallèle);11/03/2027;15/03/2027;1',
    '4;Gros œuvre;21/03/2027;30/03/2027;"2;3"',
  ].join('\n');
  const s = await parseSchedule('planning.csv', Buffer.from(csv));
  const byName = Object.fromEntries(s.tasks.map((t) => [t.name, t]));
  assert.equal(s.planned_completion, '2027-03-30');
  assert.equal(byName['Fondations'].is_critical, 1);
  assert.equal(byName['Réseaux (parallèle)'].total_float_days, 5);
  assert.equal(byName['Réseaux (parallèle)'].is_critical, 0);
  assert.equal(s.float_source, 'calculée');
});

test('un jalon de fin le jour même de sa tâche prédécesseur ne crée pas de marge négative', async () => {
  const csv = 'ID;Nom;Début;Fin;Prédécesseurs\n1;Démarrage;01/03/2027;01/03/2027;\n2;Travaux;01/03/2027;31/03/2027;1\n3;Réception;31/03/2027;31/03/2027;2\n';
  const s = await parseSchedule('p.csv', Buffer.from(csv));
  for (const t of s.tasks) assert.equal(t.total_float_days, 0, t.name);
  assert.equal(s.tasks.filter((t) => t.is_critical).length, 3);
});

test('import MS Project XML et Primavera XER', async () => {
  const xml = `<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><MinutesPerDay>480</MinutesPerDay><StatusDate>2027-03-15T08:00:00</StatusDate><Tasks>
    <Task><UID>0</UID><Name>Projet</Name><Summary>1</Summary></Task>
    <Task><UID>1</UID><Name>Lot 1</Name><WBS>1</WBS><Summary>1</Summary><Start>2027-03-01T08:00:00</Start><Finish>2027-04-30T17:00:00</Finish></Task>
    <Task><UID>2</UID><Name>Terrassement</Name><WBS>1.1</WBS><Start>2027-03-01T08:00:00</Start><Finish>2027-03-10T17:00:00</Finish><Duration>PT64H0M0S</Duration><Critical>1</Critical><TotalSlack>0</TotalSlack><PercentComplete>100</PercentComplete></Task>
    <Task><UID>3</UID><Name>Fondations</Name><WBS>1.2</WBS><Start>2027-03-11T08:00:00</Start><Finish>2027-04-30T17:00:00</Finish><Critical>0</Critical><TotalSlack>48000</TotalSlack>
      <PredecessorLink><PredecessorUID>2</PredecessorUID><Type>1</Type><LinkLag>4800</LinkLag></PredecessorLink>
      <Baseline><Number>0</Number><Start>2027-03-11T08:00:00</Start><Finish>2027-04-20T17:00:00</Finish></Baseline></Task>
  </Tasks></Project>`;
  const m = await parseSchedule('planning.xml', Buffer.from(xml));
  assert.equal(m.format, 'msp');
  assert.equal(m.data_date, '2027-03-15');
  const fond = m.tasks.find((t) => t.name === 'Fondations');
  assert.equal(fond.total_float_days, 10); // 48000 dixièmes de minute / 480 min
  assert.equal(fond.baseline_finish, '2027-04-20');
  assert.deepEqual(fond.predecessors, [{ id: '2', type: 'FS', lag_days: 1 }]);

  const xer = [
    'ERMHDR\t19.12',
    '%T\tPROJECT', '%F\tproj_id\tlast_recalc_date', '%R\t1\t2027-03-15 08:00',
    '%T\tCALENDAR', '%F\tclndr_id\tday_hr_cnt', '%R\t10\t8',
    '%T\tPROJWBS', '%F\twbs_id\twbs_short_name\twbs_name\tparent_wbs_id\tproj_node_flag', '%R\t100\tPRJ\tProjet\t\tY', '%R\t101\tGC\tGénie civil\t100\tN',
    '%T\tTASK', '%F\ttask_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttotal_float_hr_cnt\tphys_complete_pct',
    '%R\t1\t101\t10\tA100\tTerrassement\tTT_Task\tTK_Active\t2027-03-01 08:00\t2027-03-10 17:00\t2027-03-01 08:00\t2027-03-12 17:00\t0\t50',
    '%R\t2\t101\t10\tA200\tFin des travaux\tTT_FinMile\tTK_NotStart\t2027-06-30 17:00\t2027-06-30 17:00\t2027-07-05 17:00\t2027-07-05 17:00\t-16\t0',
    '%T\tTASKPRED', '%F\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt', '%R\t2\t1\tPR_FS\t8',
    '%E',
  ].join('\r\n');
  const p = await parseSchedule('planning.xer', Buffer.from(xer));
  assert.equal(p.format, 'xer');
  const fin = p.tasks.find((t) => t.name === 'Fin des travaux');
  assert.equal(fin.total_float_days, -2);
  assert.equal(fin.is_critical, 1);
  assert.equal(fin.is_milestone, 1);
  assert.equal(fin.wbs_code, 'GC · A200');
  assert.equal(fin.baseline_finish, '2027-06-30');
  assert.equal(p.planned_completion, '2027-07-05');
  await assert.rejects(parseSchedule('planning.mpp', Buffer.from('x')), /Format XML/);
});

test('V2 : GED plein texte, planning, visas, finances, courriers, points d’attention et IA', async () => {
  const c = await api('POST', '/api/contracts', {
    title: 'Groupement Lot 3', reference: 'MP-2026-08', framework: 'FR_PUBLIC', my_role: 'Titulaire', amount: 1_000_000,
    completion_date: '2027-06-30', payment_days: 30, retention_percent: 5, group_type: 'solidaire', project_manager: 'MOE Ingénierie',
  });

  // GED : extraction PDF et DOCX, recherche insensible aux accents
  const pdf = makePdf(['ARTICLE 4.3 - Penalites de retard', 'Le titulaire subit une penalite de 1/1000 par jour calendaire.']);
  const docxBuf = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Le CCTP impose un béton C30/37 pour les fondations.')] }] }));
  assert.match((await mammoth.extractRawText({ buffer: docxBuf })).value, /béton/);
  const saved = await upload('/api/documents/upload', { contract_id: c.id, category: 'CCAP' }, [{ name: 'CCAP.pdf', content: pdf }]);
  assert.equal(saved[0].text_status, 'ok');
  assert.equal(saved[0].content_text, undefined, 'le texte n’est pas renvoyé au navigateur');
  await upload('/api/documents/upload', { contract_id: c.id, category: 'CCTP' }, [{ name: 'CCTP.docx', content: docxBuf }]);
  const hits = await api('GET', `/api/search?q=${encodeURIComponent('pénalité')}`);
  const pdfHit = hits.find((r) => r.kind === 'documents' && r.title === 'CCAP');
  assert.ok(pdfHit, 'trouvé dans le contenu du PDF malgré les accents');
  assert.match(pdfHit.excerpt, /⟦Penalite/);
  assert.ok((await api('GET', '/api/search?q=beton')).some((r) => r.title === 'CCTP'));

  // Organisation : groupement mal réparti → point critique
  await api('POST', '/api/group_members', { contract_id: c.id, company: 'Alpha BTP', role: 'mandataire', share_percent: 60 });
  await api('POST', '/api/group_members', { contract_id: c.id, company: 'Beta TP', role: 'cotraitant', share_percent: 30 });
  const sh = await api('POST', '/api/stakeholders', { contract_id: c.id, name: 'J. Martin', organisation: 'MOE Ingénierie', role: 'Maître d’œuvre' });
  await api('POST', '/api/raci_items', { contract_id: c.id, activity: 'Visa des plans EXE', assignments: JSON.stringify({ [sh.id]: 'A' }) });
  await api('POST', '/api/communication_rules', { contract_id: c.id, subject: 'Relances de paiement', info_type: 'Paiement', recipients: 'Service financier – Mairie', cc: 'MOE Ingénierie', channel: 'LRAR' });

  // Revue : check-list type, idempotente
  assert.ok((await api('POST', `/api/contracts/${c.id}/review/template`)).added > 10);
  assert.equal((await api('POST', `/api/contracts/${c.id}/review/template`)).added, 0);

  // Planning en retard sur la date contractuelle
  const csv = 'ID;Nom;Début;Fin;Prédécesseurs\n1;Préparation;01/03/2027;30/04/2027;\n2;Travaux;01/05/2027;31/07/2027;1\n';
  const imp = await upload(`/api/contracts/${c.id}/schedule/import`, { name: 'Planning indice A' }, [{ name: 'planning.csv', content: csv }], 'file');
  assert.equal(imp.planned_completion, '2027-07-31');
  assert.equal(imp.critical_count, 2);
  const csvB = csv.replace('31/07/2027', '15/08/2027');
  const impB = await upload(`/api/contracts/${c.id}/schedule/import`, { name: 'Planning indice B' }, [{ name: 'planning-b.csv', content: csvB }], 'file');
  const cmp = await api('GET', `/api/schedule-compare?from=${imp.id}&to=${impB.id}`);
  assert.equal(cmp.completion_delta_days, 15);
  assert.equal(cmp.changes[0].name, 'Travaux');

  // Visas : délai de 15 jours par défaut, nouvel indice
  const visa = await api('POST', '/api/submittals', { contract_id: c.id, title: 'Plan de coffrage R+1', submitted_date: addDays(today(), -20) });
  assert.equal(visa.number, 'VIS-001');
  assert.equal(visa.computed_visa_due, addDays(today(), -5));
  assert.equal(visa.overdue, true);
  await api('PUT', `/api/submittals/${visa.id}`, { visa_status: 'refusé', visa_date: today() });
  const rev = await api('POST', `/api/submittals/${visa.id}/revision`);
  assert.equal(rev.revision, 'B');
  assert.equal(rev.number, 'VIS-001');

  // Finances : avenant signé, situation en retard de paiement
  await api('POST', '/api/amendments', { contract_id: c.id, title: 'Travaux supplémentaires', amount: 150_000, extra_days: 20, status: 'signé' });
  const sit = await api('POST', '/api/payments', { contract_id: c.id, period: 'mars 2027', submitted_date: addDays(today(), -45), amount_requested: 200_000, amount_validated: 180_000 });
  assert.equal(sit.overdue, true);
  const fin = await api('GET', `/api/contracts/${c.id}/finance`);
  assert.equal(fin.current, 1_150_000);
  assert.equal(fin.invoiced, 180_000);
  assert.equal(fin.retention, 9_000);
  assert.equal(Math.round(fin.variation_percent), 15);

  // Échéances V2 et points d'attention
  const deadlines = await api('GET', `/api/deadlines?contract_id=${c.id}`);
  assert.ok(deadlines.some((d) => d.kind === 'paiement' && d.overdue));
  assert.ok(deadlines.some((d) => d.kind === 'visa'));
  const insights = await api('GET', `/api/insights?contract_id=${c.id}`);
  const titles = insights.map((i) => i.title).join('\n');
  assert.match(titles, /Quotes-parts du groupement : 90\.00 %/);
  assert.match(titles, /achèvement 46 j après la date contractuelle/);
  assert.match(titles, /Glissement de 15 j/);
  assert.match(titles, /paiement\(s\) en retard/);
  assert.match(titles, /Pièces de référence manquantes : Contrat, CCAG Travaux, BPU/);
  assert.equal(insights[0].level, 'critique');

  // Courrier : relance de paiement → destinataire issu de la matrice de communication, .docx archivé
  const preview = await api('POST', '/api/letters/preview', { contract_id: c.id, template: 'payment_reminder', entity_id: sit.id });
  assert.equal(preview.recipient, 'Service financier – Mairie');
  assert.match(preview.body.replace(/\s/g, ' '), /180 000,00/);
  assert.match(preview.body, new RegExp(`fixée au ${addDays(today(), -15).split('-').reverse().join('/')}`));
  await api('PUT', '/api/settings', { company_name: 'Alpha BTP', city: 'Lyon', signatory_name: 'S. Moula' });
  const gen = await api('POST', '/api/letters/generate', { contract_id: c.id, template: 'payment_reminder', entity_id: sit.id, ...preview });
  assert.equal(gen.correspondence.direction, 'sortant');
  assert.equal(gen.correspondence.status, 'à envoyer');
  const docx = Buffer.from(await (await fetch(`${base}/api/documents/${gen.document.id}/file`)).arrayBuffer());
  const letterText = (await mammoth.extractRawText({ buffer: docx })).value;
  assert.match(letterText, /Lyon, le/);
  assert.match(letterText, /Relance – demande de paiement SIT-001/);

  // IA (faux Ollama) : revue, application des propositions, question, triage
  const settings = await api('PUT', '/api/settings', { ai_mode: 'ollama', ollama_url: `http://127.0.0.1:${ollama.address().port}`, claude_api_key: 'sk-test' });
  assert.equal(settings.has_claude_key, true);
  assert.equal(settings.claude_api_key, undefined, 'la clé API n’est jamais renvoyée');
  const reviewed = await api('POST', '/api/ai/review', { contract_id: c.id });
  assert.equal(reviewed.provider, 'ollama', 'contrat non autorisé pour le cloud → IA locale');
  assert.equal(reviewed.review_items[0].risk_level, 'critique');
  const sent = ollamaRequests.at(-1);
  assert.ok(sent.format?.properties?.review_items, 'schéma JSON transmis à Ollama');
  assert.match(sent.messages[1].content, /Penalites de retard/);
  assert.doesNotMatch(sent.messages[1].content, /Relance – demande/, 'les échanges ne sont pas envoyés pour la revue');
  const applied = await api('POST', '/api/ai/review/apply', { contract_id: c.id, review_items: reviewed.review_items, key_dates: reviewed.key_dates, obligations: reviewed.obligations });
  assert.equal(applied.created, 3, 'la date vide est ignorée');
  const ask = await api('POST', '/api/ai/ask', { contract_id: c.id, question: 'Quel est le taux des pénalités de retard ?' });
  assert.equal(ask.sources[0].title, 'CCAP');
  const mail = await api('POST', '/api/correspondence', { contract_id: c.id, subject: 'Modification du phasage', summary: 'Merci de chiffrer.' });
  const triage = await api('POST', '/api/ai/triage', { correspondence_id: mail.id });
  assert.equal(triage.risk, 'compensation_event');

  // Ollama arrêté → message d'erreur explicite
  await api('PUT', '/api/settings', { ollama_url: 'http://127.0.0.1:9' });
  const res = await fetch(`${base}/api/ai/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contract_id: c.id, question: 'test' }) });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /Ollama ne répond pas/);
});
