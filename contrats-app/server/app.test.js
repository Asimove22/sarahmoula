import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { addDays, today } from './deadlines.js';

let server;
let base;
let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contrats-test-'));
  const app = createApp({ db: openDatabase(dataDir), dataDir });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const api = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
};

const uploadFiles = (url, fields, fileList) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  for (const f of fileList) form.append('files', new Blob([f.content]), f.name);
  return fetch(base + url, { method: 'POST', body: form }).then((r) => r.json());
};

test('cycle complet : contrat, EW, CE, échéances, documents, import email, ICS, CSV', async () => {
  const contract = await api('POST', '/api/contracts', {
    title: 'Lot 2 – Génie civil',
    reference: 'NEC-2026-01',
    framework: 'NEC4',
    my_role: 'Entrepreneur',
    end_date: addDays(today(), 60),
    notice_period_days: 30,
    tacit_renewal: true,
  });
  assert.equal(contract.tacit_renewal, 1);

  const ew = await api('POST', '/api/early_warnings', { contract_id: contract.id, title: 'Sol pollué', next_review_date: addDays(today(), 5) });
  assert.equal(ew.number, 'EW-001');
  const ew2 = await api('POST', '/api/early_warnings', { contract_id: contract.id, title: 'Retard approvisionnement' });
  assert.equal(ew2.number, 'EW-002');

  const aware = addDays(today(), -60); // 60 jours > 8 semaines : forclusion dépassée
  const ce = await api('POST', '/api/compensation_events', {
    contract_id: contract.id,
    title: 'Dépollution',
    early_warning_id: ew.id,
    notified_by: 'Entrepreneur',
    date_aware: aware,
  });
  assert.equal(ce.number, 'CE-001');
  assert.equal(ce.notify_deadline, addDays(aware, 56));
  assert.equal(ce.time_barred_risk, true);

  const updated = await api('PUT', `/api/compensation_events/${ce.id}`, { date_notified: today(), quotation_instructed_date: today() });
  assert.equal(updated.pm_reply_due, addDays(today(), 7));
  assert.equal(updated.quotation_due, addDays(today(), 21));

  const deadlines = await api('GET', `/api/deadlines?contract_id=${contract.id}`);
  const titles = deadlines.map((d) => d.title);
  assert.ok(titles.some((t) => t.includes('dénonciation')), 'date limite de dénonciation');
  assert.ok(titles.some((t) => t.includes('remise du devis')));
  assert.ok(titles.some((t) => t.startsWith('EW-001')));
  assert.equal(deadlines.find((d) => d.title.includes('dénonciation')).date, addDays(today(), 30));

  // Documents et versions
  const [doc] = await uploadFiles('/api/documents/upload', { contract_id: contract.id, category: 'Contrat' }, [{ name: 'Contrat signé.pdf', content: '%PDF-1.4 v1' }]);
  assert.equal(doc.title, 'Contrat signé');
  const [unicodeDoc] = await uploadFiles('/api/documents/upload', { contract_id: contract.id, category: 'Annexe' }, [{ name: 'Annexe 2 – Prix (DPGF) é€.pdf', content: 'x' }]);
  assert.equal(unicodeDoc.original_name, 'Annexe 2 – Prix (DPGF) é€.pdf');
  await api('DELETE', `/api/documents/${unicodeDoc.id}`);
  assert.equal(doc.version, 1);
  const [v2] = await uploadFiles('/api/documents/upload', { contract_id: contract.id, parent_id: doc.id }, [{ name: 'Contrat signé v2.pdf', content: '%PDF-1.4 v2' }]);
  assert.equal(v2.version, 2);
  assert.equal(v2.category, 'Contrat');
  const current = await api('GET', `/api/documents?contract_id=${contract.id}`);
  assert.equal(current.length, 1);
  assert.equal(current[0].versions_count, 2);
  assert.equal(await api('GET', `/api/documents/${v2.id}/file`), '%PDF-1.4 v2');
  await api('DELETE', `/api/documents/${v2.id}`);
  const afterDelete = await api('GET', `/api/documents?contract_id=${contract.id}`);
  assert.equal(afterDelete[0].id, doc.id, 'la v1 redevient courante');
  assert.ok(fs.existsSync(path.join(dataDir, 'corbeille', v2.stored_name)), 'fichier déplacé en corbeille');

  // Import d'un email .eml avec pièce jointe
  const eml = [
    'From: Chef de projet <pm@client.fr>',
    'To: moi@entreprise.fr',
    'Subject: Instruction de devis CE-001',
    'Date: Mon, 26 Oct 2026 10:00:00 +0100',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="XX"',
    '',
    '--XX',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Merci de transmettre votre devis sous 3 semaines.',
    '--XX',
    'Content-Type: application/pdf; name="instruction.pdf"',
    'Content-Disposition: attachment; filename="instruction.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('%PDF instruction').toString('base64'),
    '--XX--',
    '',
  ].join('\r\n');
  const [mail] = await uploadFiles('/api/correspondence/import', { contract_id: contract.id }, [{ name: 'instruction.eml', content: eml }]);
  assert.equal(mail.subject, 'Instruction de devis CE-001');
  assert.equal(mail.reference, 'ENT-001');
  assert.equal(mail.date, '2026-10-26');
  assert.match(mail.sender, /pm@client\.fr/);
  assert.equal(mail.attachments, 1);
  const mailDocs = await api('GET', `/api/documents?correspondence_id=${mail.id}`);
  assert.deepEqual(mailDocs.map((d) => d.category).sort(), ['Pièce jointe', 'Échange']);

  // Recherche, tableau de bord, calendrier, export
  const results = await api('GET', '/api/search?q=devis');
  assert.ok(results.some((r) => r.kind === 'correspondence'));
  const dash = await api('GET', '/api/dashboard');
  assert.equal(dash.stats.open_early_warnings, 2);
  assert.ok(dash.upcoming.length > 0);
  const ics = await api('GET', '/api/calendar.ics');
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART;VALUE=DATE:\d{8}/);
  assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75));
  const csv = await api('GET', `/api/export/early_warnings.csv?contract_id=${contract.id}`);
  assert.ok(csv.startsWith('id;'));
  const raw = Buffer.from(await (await fetch(`${base}/api/export/early_warnings.csv`)).arrayBuffer());
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM UTF-8 pour Excel');
  assert.equal(csv.trim().split('\r\n').length, 3);

  const journal = await api('GET', `/api/journal?contract_id=${contract.id}`);
  assert.ok(journal.some((j) => j.action === 'nouvelle version'));
});
