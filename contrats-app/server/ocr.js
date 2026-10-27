// OCR des documents scannés (PDF image, photos) avec Tesseract, entièrement hors ligne.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { extractImages, getDocumentProxy } from 'unpdf';
import { createWorker } from 'tesseract.js';
import { indexDocument } from './extract.js';

const require = createRequire(import.meta.url);
const LANGS = ['fra', 'eng'];
const MAX_PAGES = 300;
export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'bmp', 'tif', 'tiff'];

const ext = (name) => name.toLowerCase().split('.').pop();

/** Un document a besoin d'OCR s'il s'agit d'une image ou d'un PDF sans texte. */
export function needsOcr(doc) {
  const e = ext(doc.original_name);
  return (e === 'pdf' && doc.text_status === 'vide') || (IMAGE_EXT.includes(e) && ['non supporté', null].includes(doc.text_status ?? null));
}

/** Image brute (pixels) → PNM, format lu nativement par Tesseract. */
function toPnm(img) {
  const { width, height, channels } = img;
  let px = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  if (channels === 4 || channels === 2) {
    const step = channels;
    const out = Buffer.alloc(width * height * (channels === 4 ? 3 : 1));
    for (let i = 0, j = 0; i < px.length; i += step) {
      if (channels === 4) {
        out[j++] = px[i];
        out[j++] = px[i + 1];
        out[j++] = px[i + 2];
      } else out[j++] = px[i];
    }
    px = out;
  }
  const gray = channels === 1 || channels === 2;
  return Buffer.concat([Buffer.from(`P${gray ? 5 : 6}\n${width} ${height}\n255\n`), px]);
}

export function createOcr(db, dataDir, { onDocumentText } = {}) {
  const langDir = path.join(dataDir, 'ocr-langues');
  let workerPromise = null;
  const queue = [];
  let running = false;

  // Les modèles de langue sont livrés par npm : on les copie dans le dossier de données (aucun téléchargement).
  const prepareLanguages = () => {
    fs.mkdirSync(langDir, { recursive: true });
    for (const l of LANGS) {
      const target = path.join(langDir, `${l}.traineddata.gz`);
      if (!fs.existsSync(target)) {
        const pkgDir = path.dirname(require.resolve(`@tesseract.js-data/${l}/package.json`));
        fs.copyFileSync(path.join(pkgDir, '4.0.0_best_int', `${l}.traineddata.gz`), target);
      }
    }
  };

  const worker = () => {
    if (!workerPromise) {
      prepareLanguages();
      workerPromise = createWorker(LANGS, 1, { langPath: langDir, cachePath: langDir, gzip: true });
    }
    return workerPromise;
  };

  async function recognize(buffer) {
    const w = await worker();
    const { data } = await w.recognize(buffer);
    return { text: data.text ?? '', confidence: data.confidence ?? 0 };
  }

  /** Texte d'un PDF scanné : OCR de la plus grande image de chaque page. */
  async function ocrPdf(buffer) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    const texts = [];
    const confidences = [];
    for (let n = 1; n <= pages; n++) {
      let images = [];
      try {
        images = await extractImages(pdf, n);
      } catch {
        images = [];
      }
      const largest = images.sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (!largest || largest.width < 200 || largest.height < 200) continue;
      const { text, confidence } = await recognize(toPnm(largest));
      if (text.trim()) {
        texts.push(`--- page ${n} ---\n${text.trim()}`);
        confidences.push(confidence);
      }
    }
    const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
    return { text: texts.join('\n\n'), confidence };
  }

  async function process(id) {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!doc) return;
    const file = path.join(dataDir, 'files', doc.stored_name);
    if (!fs.existsSync(file)) return;
    db.prepare("UPDATE documents SET text_status = 'ocr en cours' WHERE id = ?").run(id);
    try {
      const buffer = fs.readFileSync(file);
      const { text, confidence } = ext(doc.original_name) === 'pdf' ? await ocrPdf(buffer) : await recognize(buffer);
      const clean = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      const status = clean.length > 20 ? 'ocr' : 'ocr vide';
      db.prepare('UPDATE documents SET content_text = ?, text_status = ?, ocr_confidence = ? WHERE id = ?').run(clean || null, status, Math.round(confidence), id);
      indexDocument(db, doc, clean);
      if (status === 'ocr') onDocumentText?.({ ...doc, content_text: clean, text_status: status });
    } catch (e) {
      console.warn(`OCR impossible (${doc.original_name}) :`, e.message);
      db.prepare("UPDATE documents SET text_status = 'ocr échoué' WHERE id = ?").run(id);
    }
  }

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (queue.length) await process(queue.shift());
    } finally {
      running = false;
    }
  }

  return {
    enqueue(id) {
      if (queue.includes(id)) return;
      db.prepare("UPDATE documents SET text_status = 'ocr en attente' WHERE id = ?").run(id);
      queue.push(id);
      drain();
    },
    /** Reprend les documents en attente (dont ceux interrompus par un arrêt de l'application). */
    resume() {
      const rows = db
        .prepare("SELECT * FROM documents WHERE is_current = 1 AND text_status IN ('vide', 'non supporté', 'ocr en attente', 'ocr en cours')")
        .all()
        .filter((d) => ['ocr en attente', 'ocr en cours'].includes(d.text_status) || needsOcr(d));
      for (const d of rows) this.enqueue(d.id);
      return rows.length;
    },
    pending: () => queue.length + (running ? 1 : 0),
    async idle() {
      while (running || queue.length) await new Promise((r) => setTimeout(r, 50));
    },
    async close() {
      if (workerPromise) await (await workerPromise).terminate();
      workerPromise = null;
    },
  };
}
