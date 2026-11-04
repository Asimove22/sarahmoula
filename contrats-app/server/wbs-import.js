// Import d'une WBS depuis : Excel / CSV (colonnes reconnues), MS Project XML ou Primavera P6 XER (codes WBS des
// tâches), ou un document texte (PDF, Word, PowerPoint) dont les lignes commencent par un code « 1.2.3 Intitulé ».
import { extractDocumentText } from './extract.js';
import { readWorkbook } from './imports.js';
import { parseSchedule } from './schedule.js';
import { parseAmount } from './invoice.js';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const parentOf = (code) => (String(code).includes('.') ? String(code).split('.').slice(0, -1).join('.') : null);

const HEADERS = {
  code: /^(code|code wbs|wbs|edt|n°?|no|num(ero)?|ref(erence)?|id|lot)$/,
  title: /^(intitule|libelle|designation|tache|activite|nom|titre|description|element|ouvrage|work package|name|task)/,
  parent_code: /^(parent|code parent|niveau superieur)/,
  budget: /^(budget|montant|cout|prix|valeur|amount)/,
  owner: /^(responsable|pilote|owner|charge|porteur)/,
};

function fromTable(rows) {
  let headerRow = rows.findIndex((r) => r.some((c) => HEADERS.code.test(norm(c))) && r.some((c) => HEADERS.title.test(norm(c))));
  const map = {};
  if (headerRow >= 0) {
    rows[headerRow].forEach((c, i) => {
      for (const [field, re] of Object.entries(HEADERS)) if (map[field] === undefined && re.test(norm(c))) map[field] = i;
    });
  } else {
    headerRow = -1;
    map.code = 0;
    map.title = 1;
  }
  return rows.slice(headerRow + 1).map((r) => ({
    code: String(r[map.code] ?? '').trim(),
    title: String(r[map.title] ?? '').trim(),
    parent_code: map.parent_code !== undefined ? String(r[map.parent_code] ?? '').trim() || null : null,
    budget: map.budget !== undefined ? parseAmount(String(r[map.budget] ?? '')) : null,
    owner: map.owner !== undefined ? String(r[map.owner] ?? '').trim() || null : null,
  })).filter((x) => x.code && x.title);
}

function fromText(text) {
  const items = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*((?:\d{1,3}|[A-Z])(?:\.\d{1,3})+|\d{1,2})\.?\s*[-–:)]?\s+([^\n]{3,160})$/);
    if (!m || /^\d{4}$/.test(m[1])) continue;
    const title = m[2].replace(/\s*\.{3,}\s*\d+\s*$/, '').trim(); // sommaire : « Titre ........ 12 »
    if (title) items.push({ code: m[1], title });
  }
  // Un texte sans aucun code hiérarchique (1.1, 2.3…) n'est pas une WBS.
  return items.some((i) => i.code.includes('.')) ? items : [];
}

async function fromSchedule(filename, buffer) {
  const parsed = await parseSchedule(filename, buffer);
  const items = [];
  for (const t of parsed.tasks) {
    if (!t.wbs_code) continue;
    const code = t.wbs_code.includes(' · ') ? t.wbs_code.split(' · ')[0] : t.wbs_code;
    if (t.is_summary || !items.some((i) => i.code === code)) items.push({ code, title: t.is_summary ? t.name : t.name });
  }
  return items;
}

/** @returns {Promise<{ items: { code, title, parent_code?, budget?, owner? }[], source: string }>} */
export async function parseWbs(filename, buffer) {
  const ext = filename.toLowerCase().split('.').pop();
  let items = [];
  let source;
  if (['xlsx', 'xlsm', 'csv'].includes(ext)) {
    const sheets = await readWorkbook(filename, buffer);
    items = fromTable(sheets[0]?.rows ?? []);
    source = 'tableau';
  } else if (['xml', 'xer'].includes(ext)) {
    items = await fromSchedule(filename, buffer);
    source = ext === 'xer' ? 'Primavera P6' : 'MS Project';
  } else {
    const { text } = await extractDocumentText(filename, buffer);
    items = fromText(text ?? '');
    source = 'document';
  }
  // Dédoublonnage par code (la dernière occurrence l'emporte), parent déduit du code.
  const byCode = new Map();
  for (const i of items) byCode.set(i.code, { ...byCode.get(i.code), ...i, parent_code: i.parent_code || parentOf(i.code) });
  return { items: [...byCode.values()], source };
}
