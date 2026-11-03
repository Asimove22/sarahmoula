import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph } from 'docx';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { parseInvoice, parseLetter } from './invoice.js';

let server;
let base;
let dataDir;
let app;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contrats-v5-'));
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

const api = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (res.status >= 400) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
};
const upload = async (url, files, fields) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  for (const [name, buffer] of files) form.append('files', new Blob([buffer]), name);
  const res = await fetch(base + url, { method: 'POST', body: form });
  const data = await res.json();
  if (res.status >= 400) throw new Error(`${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
};
const docx = (lines) => Packer.toBuffer(new Document({ sections: [{ children: lines.map((l) => new Paragraph(l)) }] }));

/** Présentation .pptx minimale : une diapositive avec deux paragraphes. */
async function pptx(paragraphs) {
  const zip = new JSZip();
  const runs = paragraphs.map((p) => `<a:p><a:r><a:t>${p}</a:t></a:r></a:p>`).join('');
  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?><p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree><p:sp><p:txBody>${runs}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  zip.file('[Content_Types].xml', '<Types/>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('lecture des factures et des courriers', () => {
  const inv = parseInvoice('FACTURE N° FA-2026-0147\nDate de facture : 15/10/2026\nPériode : septembre 2026\nTotal HT 245 680,40 €\nTVA 20 % 49 136,08 €\nTotal TTC 294 816,48 €');
  assert.deepEqual(inv, { number: 'FA-2026-0147', date: '2026-10-15', period: 'septembre 2026', amount_ht: 245680.4, amount_ttc: 294816.48, situation: false });
  assert.equal(parseInvoice('Invoice No. INV-88\nInvoice date: 2026-09-30\nTotal excl. VAT 1,250.00\nAmount due 1,500.00').amount_ttc, 1500);
  const l = parseLetter('Lyon, le 12 mars 2026\nN/Réf : DT-L15-0451\nObjet : Sujétions imprévues fondations\npour un montant de 120 000,00 € HT et 45 jours de délai supplémentaires', 'x.pdf');
  assert.equal(l.title, 'Sujétions imprévues fondations');
  assert.equal(l.date, '2026-03-12');
  assert.equal(l.amount, 120000);
  assert.equal(l.days, 45);
  assert.equal(parseLetter('', 'Mémoire_réclamation-lot15.pdf').title, 'Mémoire réclamation lot15');
});

test('import de documents : situations, réclamations, avenants, documents rattachés', async () => {
  const c = await api('POST', '/api/contracts', { title: 'Lot 15', framework: 'FR_PUBLIC', buyer_type: 'etat', amount: 2_000_000 });

  // Facture Word et situation Excel → deux situations, chacune avec son document.
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Situation');
  ws.addRows([['Situation n° 7'], ['Date de situation', '30/09/2026'], ['Période', 'septembre 2026'], ['Total HT', 98000.5], ['Total TTC', 117600.6]]);
  const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
  const invoice = await docx(['Facture N° FA-2026-0147', 'Date de facture : 15/10/2026', 'Total HT 245 680,40 €', 'Total TTC 294 816,48 €']);
  const pays = await upload('/api/payments/import-documents', [['facture-0147.docx', invoice], ['situation-7.xlsx', xlsx]], { contract_id: c.id });
  assert.equal(pays.length, 2);
  assert.equal(pays[0].number, 'SIT-001');
  assert.equal(pays[0].amount_requested, 245680.4);
  assert.equal(pays[0].submitted_date, '2026-10-15');
  assert.match(pays[0].notes, /n° FA-2026-0147, HT 245[\s ]680,40 €, TTC 294[\s ]816,48 €/);
  assert.ok(pays[0].computed_due_date, 'échéance calculée avec le délai légal de 30 jours');
  assert.equal(pays[1].amount_requested, 98000.5);
  assert.equal(pays[1].period, 'septembre 2026');
  const docs = await api('GET', `/api/documents?contract_id=${c.id}&payment_id=${pays[0].id}`);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].category, 'Facture / Situation');
  assert.equal(docs[0].reference, 'FA-2026-0147');
  assert.equal((await api('GET', `/api/payments?contract_id=${c.id}`)).find((p) => p.id === pays[0].id).documents_count, 1);

  // Courrier PowerPoint → réclamation, texte indexé pour la recherche.
  const deck = await pptx(['Objet : Réclamation sujétions imprévues', 'Paris, le 02/09/2026 – montant de 85 000,00 € et 20 jours de délai supplémentaires']);
  const [claim] = await upload('/api/claims/import-documents', [['reclamation.pptx', deck]], { contract_id: c.id });
  assert.equal(claim.number, 'REC-001');
  assert.equal(claim.title, 'Réclamation sujétions imprévues');
  assert.equal(claim.dispute_date, '2026-09-02');
  assert.equal(claim.amount_claimed, 85000);
  assert.equal(claim.extra_days_claimed, 20);
  assert.equal(claim.computed_memo_due, '2026-11-02');
  const found = await api('GET', '/api/search?q=sujétions');
  assert.ok(found.some((r) => r.kind === 'documents' && r.title === 'Réclamation sujétions imprévues'));

  // Document sans texte lisible : l'élément est créé avec le nom du fichier, à compléter.
  const [amend] = await upload('/api/amendments/import-documents', [['Avenant_n2_signe.pdf', Buffer.from('%PDF-1.4 rien')]], { contract_id: c.id });
  assert.equal(amend.title, 'Avenant n2 signe');
  assert.equal(amend.read_fields, 0);

  // Ajout manuel d'un document à une réclamation existante (fenêtre de l'élément).
  await upload('/api/documents/upload', [['annexe.docx', await docx(['Annexe chiffrée'])]], { contract_id: c.id, category: 'Pièce jointe', claim_id: claim.id });
  assert.equal((await api('GET', `/api/documents?claim_id=${claim.id}`)).length, 2);

  // Registre sans import : refus explicite.
  const res = await fetch(`${base}/api/milestones/import-documents`, { method: 'POST', body: new FormData() });
  assert.equal(res.status, 404);
});
