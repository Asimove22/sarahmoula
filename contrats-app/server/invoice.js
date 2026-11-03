// Lecture des informations clés d'une facture ou d'une situation de travaux, et d'un courrier,
// à partir du texte extrait (PDF, Word, Excel). Les valeurs trouvées sont des propositions à vérifier.

const MONTHS = { janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12 };
const pad = (n) => String(n).padStart(2, '0');

/** Montant écrit à la française ou à l'anglaise : « 1 234 567,89 », « 1.234.567,89 », « 1,234,567.89 ». */
export function parseAmount(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/[\s  €]|EUR/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Date au format JJ/MM/AAAA, JJ.MM.AA, AAAA-MM-JJ ou « 12 mars 2026 » → AAAA-MM-JJ. */
export function parseDate(raw) {
  if (!raw) return null;
  let m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    if (Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 1 && Number(m[1]) <= 31) return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  m = raw.toLowerCase().match(/(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/);
  if (m && MONTHS[m[2]]) return `${m[3]}-${pad(MONTHS[m[2]])}-${pad(m[1])}`;
  return null;
}

// Avec séparateurs de milliers (« 245 680,40 ») ou sans (« 98000.5 ») : la première forme exige au moins un groupe.
const AMOUNT = String.raw`(-?\d{1,3}(?:[ \u00a0\u202f.,]\d{3})+(?:[.,]\d{1,2})?(?!\d)|-?\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR)?`;
const DATE = String.raw`(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:er)?\s+[A-Za-zéûÉÛ]+\s+\d{4})`;

/** Dernier montant qui suit un libellé (les totaux sont en bas de facture). */
function amountAfter(text, labels) {
  const re = new RegExp(String.raw`(?:${labels})[^\n\d-]{0,40}${AMOUNT}`, 'gi');
  let found = null;
  for (const m of text.matchAll(re)) {
    const n = parseAmount(m[1]);
    if (n !== null && Math.abs(n) >= 1) found = n;
  }
  return found;
}

function dateAfter(text, labels) {
  const m = text.match(new RegExp(String.raw`(?:${labels})[^\n\d]{0,25}${DATE}`, 'i'));
  return m ? parseDate(m[1]) : null;
}

/**
 * Facture / situation : numéro, date, période, montants HT et TTC.
 * @returns {{ number: string|null, date: string|null, period: string|null, amount_ht: number|null, amount_ttc: number|null, situation: boolean }}
 */
export function parseInvoice(text = '') {
  const t = text.replace(/\r/g, '');
  const number = t.match(/(?:facture|situation|invoice|avoir)\s*(?:n[°ºo]\.?|num[ée]ro|no\.?|#)\s*:?\s*([A-Z0-9][A-Z0-9/_.-]{0,30})/i)?.[1] ?? null;
  const date = dateAfter(t, String.raw`date\s+(?:de\s+(?:la\s+)?)?(?:facture|facturation|émission|emission|situation)|facture\s+du|situation\s+du|invoice\s+date|date`)
    ?? parseDate(t.match(new RegExp(DATE))?.[1]);
  const period = t.match(/(?:p[ée]riode|mois\s+de|travaux\s+(?:du\s+mois\s+)?de|arr[êe]t[ée]e?\s+au)[\s:|]*([A-Za-zéûÉÛ]+\s+\d{4}|\d{1,2}[/.-]\d{4}|du\s+[^\n]{6,40})/i)?.[1]?.trim() ?? null;
  const amount_ht = amountAfter(t, String.raw`total\s+(?:g[ée]n[ée]ral\s+)?h\.?\s?t\.?|montant\s+h\.?\s?t\.?|net\s+h\.?\s?t\.?|sous[- ]total\s+h\.?\s?t\.?|total\s+hors\s+taxes?|hors\s+taxes?|total\s+excl\.?\s+vat|net\s+amount|subtotal`);
  const amount_ttc = amountAfter(t, String.raw`total\s+t\.?\s?t\.?\s?c\.?|montant\s+t\.?\s?t\.?\s?c\.?|net\s+[àa]\s+payer|toutes\s+taxes\s+comprises|total\s+incl\.?\s+vat|amount\s+due|total\s+due`);
  return { number, date, period, amount_ht, amount_ttc, situation: /situation|d[ée]compte\s+mensuel|[ée]tat\s+d.avancement/i.test(t) };
}

/** Courrier : objet, référence et date, pour pré-remplir une réclamation, un OS ou un avenant. */
export function parseLetter(text = '', filename = '') {
  const t = text.replace(/\r/g, '');
  const subject = t.match(/(?:^|\n)\s*(?:objet|subject|re)\s*:\s*([^\n]{4,160})/i)?.[1]?.trim() ?? null;
  const reference = t.match(/(?:n\/r[ée]f|v\/r[ée]f|r[ée]f[ée]rence|r[ée]f\.?|our ref)\s*:?\s*([A-Z0-9][A-Z0-9/_.-]{2,40})/i)?.[1] ?? null;
  const date = dateAfter(t, String.raw`(?:[A-Za-zÀ-ÿ' -]{2,30},\s*)?le|date|en date du|dated`) ?? parseDate(t.match(new RegExp(DATE))?.[1]);
  const amount = amountAfter(t, String.raw`montant|somme\s+de|pour\s+un\s+total\s+de|soit|total`);
  const days = Number(t.match(/(\d{1,4})\s*(?:jours?|j\.?)\s+(?:calendaires\s+)?(?:de\s+)?(?:d[ée]lai|prolongation|suppl[ée]mentaires?)/i)?.[1] ?? 0) || null;
  const title = subject ?? filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return { title: title.slice(0, 160) || 'Document importé', reference, date, amount, days };
}
