// Import / export Excel des registres de pilotage : revue de contrat, matrice RACI, matrice de communication.
import ExcelJS from 'exceljs';

export const KINDS = ['review', 'raci', 'communication'];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

function cell(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return cell(v.result);
    if (v.text) return String(v.text);
    if (v.hyperlink) return String(v.text ?? v.hyperlink);
    return '';
  }
  return String(v).trim();
}

function splitCsv(text) {
  const firstLine = text.split(/\r?\n/)[0];
  const sep = (firstLine.match(/;/g) ?? []).length >= (firstLine.match(/,/g) ?? []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cur.trim()); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur.trim());
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur || row.length) rows.push([...row, cur.trim()]);
  return rows;
}

/** Lit un classeur Excel (.xlsx) ou un CSV. Retourne les feuilles et leurs lignes. */
export async function readWorkbook(filename, buffer) {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'xls') throw Object.assign(new Error('Ancien format .xls : dans Excel, faites « Enregistrer sous » → « Classeur Excel (*.xlsx) », puis importez ce fichier.'), { status: 400 });
  if (ext === 'csv' || ext === 'txt') return [{ name: 'CSV', rows: splitCsv(buffer.toString('utf8').replace(/^﻿/, '')).filter((r) => r.some(Boolean)) }];
  if (ext !== 'xlsx' && ext !== 'xlsm') throw Object.assign(new Error('Format non pris en charge : utilisez un fichier Excel (.xlsx) ou CSV.'), { status: 400 });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets = [];
  wb.eachSheet((ws) => {
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = [];
      for (let c = 1; c <= row.cellCount; c++) values.push(cell(row.getCell(c).value));
      rows.push(values);
    });
    if (rows.length) sheets.push({ name: ws.name, rows });
  });
  return sheets;
}

// Libellés de colonnes reconnus (comparés sans accents ni casse).
const SYNONYMS = {
  review: {
    theme: ['theme', 'sujet', 'rubrique', 'domaine', 'categorie', 'point', 'point de revue', 'thematique', 'intitule', 'objet'],
    clause_ref: ['clause', 'article', 'art', 'ref', 'reference', 'references', 'clause article', 'reference contractuelle', 'piece', 'source'],
    content: ['contenu', 'description', 'constat', 'disposition', 'dispositions', 'commentaire', 'commentaires', 'observations', 'resume', 'analyse', 'exigence', 'texte'],
    risk_level: ['risque', 'niveau de risque', 'niveau', 'criticite', 'gravite', 'cotation', 'impact', 'score', 'risk', 'note'],
    mitigation: ['mesure', 'mesures', 'action', 'actions', 'parade', 'maitrise', 'mesure de maitrise', 'plan d action', 'recommandation', 'recommandations', 'traitement'],
    owner: ['responsable', 'pilote', 'porteur', 'qui', 'owner'],
    status: ['statut', 'etat', 'avancement', 'status'],
  },
  communication: {
    subject: ['information', 'informations', 'document', 'documents', 'objet', 'livrable', 'sujet', 'quoi', 'flux', 'communication', 'type de document'],
    info_type: ['type', 'type d information', 'categorie', 'nature'],
    sender: ['emetteur', 'de', 'expediteur', 'qui', 'redacteur', 'from', 'auteur'],
    recipients: ['destinataire', 'destinataires', 'a', 'pour', 'to', 'diffusion'],
    cc: ['copie', 'cc', 'en copie', 'copies', 'pour information'],
    channel: ['canal', 'moyen', 'support', 'mode', 'media', 'mode de transmission', 'vecteur'],
    frequency: ['frequence', 'periodicite', 'quand', 'echeance'],
    delay_days: ['delai', 'delai j', 'delai jours', 'delai de transmission'],
    clause: ['clause', 'article', 'reference', 'reference contractuelle', 'ref'],
    notes: ['notes', 'remarques', 'commentaires', 'observations'],
  },
  raci: {
    activity: ['activite', 'activites', 'tache', 'taches', 'livrable', 'livrables', 'processus', 'action', 'actions', 'activity', 'task', 'intitule', 'mission'],
    wbs_code: ['wbs', 'code', 'code wbs', 'edt', 'n', 'no', 'ref', 'id'],
  },
};

/** Repère la ligne d'en-tête (parmi les 15 premières) et la correspondance colonne → champ. */
export function detectColumns(kind, rows) {
  const syn = SYNONYMS[kind];
  let best = { score: 0, index: 0, mapping: {} };
  rows.slice(0, 15).forEach((row, index) => {
    const mapping = {};
    row.forEach((h, col) => {
      const n = norm(h);
      if (!n) return;
      for (const [field, names] of Object.entries(syn)) {
        if (Object.values(mapping).includes(field)) continue;
        if (names.includes(n) || names.some((name) => name.length > 3 && n.startsWith(`${name} `))) {
          mapping[col] = field;
          break;
        }
      }
    });
    const score = Object.keys(mapping).length;
    if (score > best.score) best = { score, index, mapping };
  });
  return { headerRow: best.index, mapping: best.mapping };
}

const RISKS = ['faible', 'moyen', 'élevé', 'critique'];
/** score = true : la colonne contient une note probabilité × gravité (sur 25), et non un niveau de 1 à 4. */
export function normalizeRisk(v, { score = false } = {}) {
  const n = norm(v);
  if (!n) return null;
  const num = Number(n.replace(',', '.'));
  if (Number.isFinite(num)) {
    if (score) return num <= 4 ? 'faible' : num <= 9 ? 'moyen' : num <= 16 ? 'élevé' : 'critique';
    return RISKS[Math.max(0, Math.min(3, Math.round(num) - 1))];
  }
  if (/(tres eleve|tres fort|critique|critical|majeur|inacceptable)/.test(n)) return 'critique';
  if (/(eleve|fort|high|rouge|important|grave)/.test(n)) return 'élevé';
  if (/(moyen|modere|medium|orange|jaune|significatif)/.test(n)) return 'moyen';
  if (/(faible|bas|low|vert|mineur|negligeable)/.test(n)) return 'faible';
  return null;
}

const REVIEW_STATUSES = { 'a analyser': 'à analyser', analyse: 'analysé', 'a negocier': 'à négocier', accepte: 'accepté', valide: 'accepté', clos: 'accepté', traite: 'analysé', 'en cours': 'à analyser' };
const normalizeStatus = (v) => REVIEW_STATUSES[norm(v)] ?? 'à analyser';

/** Lettres RACI d'une cellule : « R/A », « AR », « r, c »… → « R/A ». « S » (support) devient « C ». */
export function normalizeRaci(v) {
  const letters = [...new Set(String(v ?? '').toUpperCase().replace(/S/g, 'C').match(/[RACI]/g) ?? [])];
  return ['R', 'A', 'C', 'I'].filter((l) => letters.includes(l)).join('/');
}

/** Analyse le fichier et prépare les lignes à importer (sans rien écrire). */
export async function prepareImport(kind, filename, buffer, { sheet, mapping: forced } = {}) {
  if (!KINDS.includes(kind)) throw Object.assign(new Error('Type d’import inconnu'), { status: 400 });
  const sheets = await readWorkbook(filename, buffer);
  if (!sheets.length) throw Object.assign(new Error('Le fichier est vide.'), { status: 400 });
  // Feuille choisie, sinon celle dont les en-têtes sont le mieux reconnus.
  const scored = sheets.map((s) => ({ s, d: detectColumns(kind, s.rows) }));
  const chosen = (sheet && scored.find((x) => x.s.name === sheet)) || scored.sort((a, b) => Object.keys(b.d.mapping).length - Object.keys(a.d.mapping).length)[0];
  const { rows } = chosen.s;
  const headerRow = chosen.d.headerRow;
  const mapping = forced ?? chosen.d.mapping;
  const header = rows[headerRow] ?? [];
  const data = rows.slice(headerRow + 1).filter((r) => r.some((c) => String(c).trim()));
  const warnings = [];
  const field = (r, f) => {
    const col = Object.keys(mapping).find((c) => mapping[c] === f);
    return col === undefined ? '' : String(r[Number(col)] ?? '').trim();
  };

  let items = [];
  let people = [];
  if (kind === 'review') {
    if (!Object.values(mapping).some((f) => ['theme', 'content', 'clause_ref'].includes(f))) warnings.push('Aucune colonne « Thème », « Clause » ou « Contenu » reconnue : vérifiez la correspondance des colonnes.');
    // Échelle décidée pour toute la colonne : dès qu'une valeur dépasse 4, c'est une note P×G.
    const numbers = data.map((r) => Number(field(r, 'risk_level').replace(',', '.'))).filter(Number.isFinite);
    const score = numbers.some((x) => x > 4);
    if (score) warnings.push('Colonne de risque lue comme une note probabilité × gravité sur 25 (≤4 faible, ≤9 moyen, ≤16 élevé, au-delà critique).');
    items = data
      .map((r) => {
        const raw = field(r, 'risk_level');
        const risk = normalizeRisk(raw, { score });
        return {
          theme: field(r, 'theme') || field(r, 'clause_ref') || field(r, 'content').slice(0, 60),
          clause_ref: field(r, 'clause_ref') || null,
          content: field(r, 'content') || null,
          risk_level: risk,
          risk_raw: raw && !risk ? raw : undefined,
          mitigation: field(r, 'mitigation') || null,
          owner: field(r, 'owner') || null,
          status: normalizeStatus(field(r, 'status')),
        };
      })
      .filter((i) => i.theme);
    const unknown = items.filter((i) => i.risk_raw).length;
    if (unknown) warnings.push(`${unknown} niveau(x) de risque non reconnu(s) : ils seront importés sans niveau.`);
  } else if (kind === 'communication') {
    if (!Object.values(mapping).includes('subject')) warnings.push('Colonne « Information / document » non reconnue : vérifiez la correspondance.');
    items = data
      .map((r) => ({
        subject: field(r, 'subject'),
        info_type: field(r, 'info_type') || null,
        sender: field(r, 'sender') || null,
        recipients: field(r, 'recipients') || null,
        cc: field(r, 'cc') || null,
        channel: field(r, 'channel') || null,
        frequency: field(r, 'frequency') || null,
        delay_days: Number.parseInt(field(r, 'delay_days'), 10) || null,
        clause: field(r, 'clause') || null,
        notes: field(r, 'notes') || null,
      }))
      .filter((i) => i.subject);
  } else {
    // RACI : toutes les colonnes non reconnues (et non vides) sont des intervenants.
    const activityCol = Object.keys(mapping).find((c) => mapping[c] === 'activity');
    if (activityCol === undefined) warnings.push('Colonne « Activité » non reconnue : la première colonne est utilisée.');
    const actCol = activityCol !== undefined ? Number(activityCol) : 0;
    const peopleCols = header.map((h, i) => ({ i, name: String(h).trim() })).filter((c) => c.name && c.i !== actCol && mapping[c.i] === undefined);
    people = peopleCols.map((c) => c.name);
    items = data
      .map((r) => ({
        activity: String(r[actCol] ?? '').trim(),
        wbs_code: field(r, 'wbs_code') || null,
        cells: Object.fromEntries(peopleCols.map((c) => [c.name, normalizeRaci(r[c.i])]).filter(([, v]) => v)),
      }))
      .filter((i) => i.activity);
    const noA = items.filter((i) => Object.values(i.cells).filter((v) => v.includes('A')).length !== 1).length;
    if (noA) warnings.push(`${noA} activité(s) sans approbateur unique (A) : à vérifier après import.`);
  }

  return {
    kind,
    sheets: sheets.map((s) => s.name),
    sheet: chosen.s.name,
    header_row: headerRow + 1,
    columns: header.map((h, i) => ({ index: i, header: String(h), field: mapping[i] ?? null })),
    fields: Object.keys(SYNONYMS[kind]),
    mapping,
    people,
    items,
    warnings,
  };
}

// ---------- Exports Excel mis en forme ----------
const RISK_FILL = { faible: 'FFE2E8F0', moyen: 'FFFEF3C7', élevé: 'FFFFEDD5', critique: 'FFFEE2E2' };
const RACI_FILL = { R: 'FFC7D2FE', A: 'FFFECACA', C: 'FFFDE68A', I: 'FFBAE6FD' };

function styleSheet(ws, widths) {
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.eachRow((row, n) => n > 1 && (row.alignment = { vertical: 'top', wrapText: true }));
}

export async function buildExport(kind, { contract, items, people = [] }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestion contractuelle';
  const title = `${contract.reference ? `${contract.reference} – ` : ''}${contract.title}`;
  if (kind === 'review') {
    const ws = wb.addWorksheet('Revue de contrat');
    ws.addRow(['Thème', 'Clause / article', 'Contenu / constat', 'Niveau de risque', 'Mesure de maîtrise', 'Responsable', 'Statut', 'Historique']);
    for (const r of items) {
      const row = ws.addRow([r.theme, r.clause_ref, r.content, r.risk_level, r.mitigation, r.owner, r.status, r.history]);
      if (RISK_FILL[r.risk_level]) row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RISK_FILL[r.risk_level] } };
    }
    styleSheet(ws, [24, 16, 60, 14, 45, 16, 14, 60]);
  } else if (kind === 'communication') {
    const ws = wb.addWorksheet('Matrice de communication');
    ws.addRow(['Information / document', 'Type', 'Émetteur', 'Destinataires', 'Copie', 'Canal', 'Fréquence', 'Délai (j)', 'Clause', 'Notes']);
    for (const r of items) ws.addRow([r.subject, r.info_type, r.sender, r.recipients, r.cc, r.channel, r.frequency, r.delay_days, r.clause, r.notes]);
    styleSheet(ws, [40, 18, 20, 30, 24, 14, 16, 10, 14, 30]);
  } else {
    const ws = wb.addWorksheet('Matrice RACI');
    ws.addRow(['Code WBS', 'Activité / livrable', ...people.map((p) => `${p.name}${p.organisation ? ` (${p.organisation})` : ''}`)]);
    for (const r of items) {
      let a = {};
      try {
        a = JSON.parse(r.assignments || '{}');
      } catch {
        a = {};
      }
      const row = ws.addRow([r.wbs_code, r.activity, ...people.map((p) => a[p.id] ?? '')]);
      people.forEach((p, i) => {
        const v = a[p.id];
        const c = row.getCell(i + 3);
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        if (v) {
          c.font = { bold: true };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RACI_FILL[v.includes('A') ? 'A' : v[0]] } };
        }
      });
    }
    styleSheet(ws, [12, 45, ...people.map(() => 16)]);
    // Légende dans un onglet séparé : le tableau reste réimportable tel quel.
    const legend = wb.addWorksheet('Légende');
    [['Lettre', 'Signification'], ['R', 'Réalise'], ['A', 'Approuve (un seul par activité)'], ['C', 'Consulté'], ['I', 'Informé']].forEach((r) => legend.addRow(r));
    legend.getColumn(2).width = 36;
  }
  wb.getWorksheet(1).headerFooter.oddHeader = `&L${title}`;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Modèle vierge (avec un exemple) à remplir puis importer. */
export function buildTemplate(kind) {
  const example = {
    review: { items: [{ theme: 'Pénalités de retard', clause_ref: 'CCAP art. 4.3', content: '1/1000 par jour calendaire, plafond 10 %', risk_level: 'élevé', mitigation: 'Suivi du chemin critique', owner: 'Directeur de projet', status: 'à analyser' }] },
    communication: { items: [{ subject: 'Notifications de Compensation Events', info_type: 'Compensation Event', sender: 'Entrepreneur', recipients: 'Project Manager', cc: 'Supervisor', channel: 'Plateforme', frequency: 'À l’événement', delay_days: 56, clause: '61.3' }] },
    raci: { items: [{ wbs_code: '1.1', activity: 'Viser les plans EXE', assignments: JSON.stringify({ 1: 'R', 2: 'A', 3: 'C', 4: 'I' }) }], people: [{ id: 1, name: 'Entreprise' }, { id: 2, name: 'Maître d’œuvre' }, { id: 3, name: 'Bureau de contrôle' }, { id: 4, name: 'Maître d’ouvrage' }] },
  }[kind];
  return buildExport(kind, { contract: { title: 'Modèle d’import' }, ...example });
}
