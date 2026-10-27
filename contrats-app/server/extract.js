// Extraction du texte des documents pour la recherche plein texte et l'assistant IA.
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { simpleParser } from 'mailparser';

const MAX_CHARS = 2_000_000;

/** @returns {Promise<{ text: string, status: 'ok' | 'vide' | 'non supporté' | 'erreur' }>} */
export async function extractDocumentText(filename, buffer) {
  const ext = filename.toLowerCase().split('.').pop();
  try {
    let text = '';
    if (ext === 'pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const out = await extractText(pdf, { mergePages: true });
      text = Array.isArray(out.text) ? out.text.join('\n') : out.text;
    } else if (ext === 'docx') {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else if (ext === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const lines = [];
      wb.eachSheet((ws) => {
        lines.push(`# ${ws.name}`);
        ws.eachRow((row) => lines.push((row.values ?? []).slice(1).map(cellText).join(' | ')));
      });
      text = lines.join('\n');
    } else if (['txt', 'csv', 'md', 'xml', 'xer'].includes(ext)) {
      text = buffer.toString('utf8');
    } else if (ext === 'eml') {
      const m = await simpleParser(buffer);
      text = [m.subject, m.text].filter(Boolean).join('\n');
    } else {
      return { text: '', status: 'non supporté' };
    }
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);
    // Un PDF scanné (image) ne contient pas de texte : il faudrait un OCR.
    return { text, status: text.length > 20 ? 'ok' : 'vide' };
  } catch (e) {
    console.warn(`Extraction de texte impossible (${filename}) :`, e.message);
    return { text: '', status: 'erreur' };
  }
}

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') return v.text ?? v.result ?? (v.richText ? v.richText.map((r) => r.text).join('') : '');
  return String(v);
}

/** Indexe un document dans la table FTS (titre + contenu). */
export function indexDocument(db, doc, text) {
  db.prepare('DELETE FROM documents_fts WHERE rowid = ?').run(doc.id);
  db.prepare('INSERT INTO documents_fts (rowid, title, content) VALUES (?, ?, ?)').run(doc.id, doc.title ?? '', text ?? '');
}

export function unindexDocument(db, id) {
  db.prepare('DELETE FROM documents_fts WHERE rowid = ?').run(id);
}

/** Transforme une saisie libre en requête FTS5 sûre : chaque mot devient un préfixe. */
export function ftsQuery(q) {
  const words = q
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2)
    .slice(0, 12);
  return words.map((w) => `"${w}"*`).join(' ');
}
