// Lecture d'un contrat déposé à la création : propose les champs de la fiche d'identification.
// Deux passes : règles (toujours, hors ligne) puis IA (si un moteur est actif) ; l'utilisateur corrige.
import { parseAmount, parseDate } from './invoice.js';
import { parseMonth } from './revision.js';

const AMOUNT = String.raw`(-?\d{1,3}(?:[   .,]\d{3})+(?:[.,]\d{1,2})?(?!\d)|-?\d+(?:[.,]\d{1,2})?)`;
const DATE = String.raw`(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:er)?\s+[A-Za-zéûÉÛ]+\s+\d{4})`;

const clean = (s) => s?.replace(/\s+/g, ' ').replace(/^[\s:–-]+|[\s.;,]+$/g, '').trim() || null;
function grab(text, re) {
  const m = text.match(re);
  return m ? { value: m[1], excerpt: clean(text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)) } : null;
}

function detectFramework(t) {
  const fidic = t.match(/FIDIC[^\n]{0,80}?\b(red|yellow|silver|rouge|jaune|argent)\b[^\n]{0,40}?\b(1999|2017)\b|\b(red|yellow|silver)\s+book[^\n]{0,40}?\b(1999|2017)\b/i);
  if (fidic) {
    const color = (fidic[1] ?? fidic[3]).toLowerCase();
    const year = fidic[2] ?? fidic[4];
    const book = { red: 'RED', rouge: 'RED', yellow: 'YELLOW', jaune: 'YELLOW', silver: 'SILVER', argent: 'SILVER' }[color];
    return `FIDIC_${book}_${year}`;
  }
  if (/\bFIDIC\b/i.test(t)) return /\bEPC\b|turnkey|cl[ée]s en main/i.test(t) ? 'FIDIC_SILVER_2017' : /design[- ]build|plant/i.test(t) ? 'FIDIC_YELLOW_2017' : 'FIDIC_RED_2017';
  if (/\bNEC\s?4\b|NEC4/i.test(t)) return 'NEC4';
  if (/\bNEC\s?3\b|NEC3/i.test(t)) return 'NEC3';
  if (/code de la commande publique|\bCCAG\b|pouvoir adjudicateur|march[ée] public|acte d.engagement|\bCCAP\b|r[èe]glement de la consultation|\bDCE\b|\bBPU\b|\bDPGF\b|\bDQE\b|soumissionnaire|attributaire|candidat|titulaire du march[ée]/i.test(t)) return 'FR_PUBLIC';
  if (/NF\s?P\s?03[- ]001|march[ée] priv[ée]/i.test(t)) return 'FR_PRIVE';
  return null;
}

function detectCcag(t) {
  if (/CCAG[^\n]{0,15}travaux/i.test(t)) return 'TRAVAUX_2021';
  if (/CCAG[^\n]{0,15}(?:FCS|fournitures courantes)/i.test(t)) return 'FCS_2021';
  if (/CCAG[^\n]{0,15}(?:MOE|ma[îi]trise d.[œo]euvre)/i.test(t)) return 'MOE_2021';
  if (/CCAG[^\n]{0,15}(?:PI\b|prestations intellectuelles)/i.test(t)) return 'PI_2021';
  if (/CCAG[^\n]{0,15}(?:TIC|techniques de l.information)/i.test(t)) return 'TIC_2021';
  if (/CCAG[^\n]{0,15}(?:MI\b|march[ée]s industriels)/i.test(t)) return 'MI_2021';
  return null;
}

/** Formule de révision « Cn = 0,15 + 0,85 × BT01n / BT01o » → partie fixe et indices pondérés. */
// Coefficients toujours décimaux (« 0,125 ») : pas de lecture comme séparateur de milliers.
const coef = (s) => Number(String(s).replace(',', '.'));

export function detectFormula(t) {
  const zone = t.match(/(?:C\s?n|P\s?n|K)\s*=\s*([^\n]{6,200})/i)?.[1];
  if (!zone) return null;
  const fixed = zone.match(/^\s*(0[.,]\d+)/)?.[1];
  const terms = [...zone.matchAll(/(0[.,]\d+)\s*[x×*.]?\s*\(?\s*((?:BT|TP|ICHT|EBIQ|FSD|PsdA|IM|TSC)[\s-]?\d{0,3}[A-Z]?)/gi)].map((m) => ({ index: m[2].replace(/[\s-]/g, '').replace(/(\d)[no0]$/, '$1').toUpperCase(), weight: coef(m[1]) }));
  if (!terms.length) return null;
  const base = t.match(/mois\s+(?:z[ée]ro|M\s?0|d.[ée]tablissement des prix)[^\n]{0,60}?([a-zéû]+\s+\d{4}|\d{1,2}\/\d{4})/i)?.[1];
  return { rev_enabled: 1, rev_fixed: fixed ? coef(fixed) : null, rev_terms: JSON.stringify(terms), rev_base_month: parseMonth(base) };
}

/** Extraction par règles. Retourne { values, sources } (sources : extrait du texte justifiant chaque valeur). */
export function analyzeContractText(text = '') {
  const t = text.replace(/\r/g, '');
  const values = {};
  const sources = {};
  const set = (field, value, excerpt) => {
    if (value === null || value === undefined || value === '' || Number.isNaN(value)) return;
    values[field] = value;
    if (excerpt) sources[field] = excerpt.slice(0, 220);
  };

  const fw = detectFramework(t);
  if (fw) set('framework', fw, null);
  if (fw === 'FR_PUBLIC') {
    set('ccag', detectCcag(t), null);
    if (/centre hospitalier|CHU\b|h[ôo]pital|[ée]tablissement public de sant[ée]/i.test(t)) set('buyer_type', 'sante', null);
    else if (/\b(commune|d[ée]partement|r[ée]gion|m[ée]tropole|communaut[ée] (?:de communes|d.agglom[ée]ration|urbaine)|syndicat intercommunal)\b/i.test(t)) set('buyer_type', 'collectivite', null);
    else if (/\bminist[èe]re\b|\b[ÉE]tat\b/.test(t)) set('buyer_type', 'etat', null);
    set('my_role', 'Titulaire', null);
  }
  if (/NEC/.test(fw ?? '')) {
    const opt = grab(t, /\bOption\s+([A-F])\b/);
    if (opt) set('nec_option', opt.value, opt.excerpt);
  }
  if (/accord-cadre[^\n]{0,120}bons? de commande/i.test(t)) set('agreement_type', 'bons_commande', null);
  else if (/march[ée]s? subs[ée]quents?/i.test(t)) set('agreement_type', 'marches_subsequents', null);
  else if (/contrat[- ]cadre/i.test(t)) set('agreement_type', 'contrat_cadre', null);
  for (const [field, re] of [['min_amount', /montant\s+minimum[^\d\n]{0,40}/i], ['max_amount', /montant\s+maximum[^\d\n]{0,40}/i]]) {
    const g = grab(t, new RegExp(re.source + AMOUNT + String.raw`(?=\s*(?:€|EUR\b|euros?\b|k€|HT\b|H\.T|hors taxes?))`, 'i'));
    if (g) set(field, parseAmount(g.value), g.excerpt);
  }

  const title = grab(t, /(?:objet\s+du\s+(?:march[ée]|contrat|accord[- ]cadre)|intitul[ée]\s+du\s+(?:march[ée]|contrat)|objet|the works|contract for)\s*:?\s*([^\n]{8,200})/i);
  if (title) set('title', clean(title.value), title.excerpt);
  const ref = grab(t, /(?:march[ée]|contrat|accord[- ]cadre|contract)\s*(?:n[°ºo]|num[ée]ro|no\.?|number)\s*:?\s*([A-Z0-9][A-Z0-9/_.-]{2,40})/i)
    ?? grab(t, /(?:march[ée]|accord[- ]cadre|consultation|contrat)\s+(?:r[ée]f[ée]renc[ée]\s+)?([A-Z]{2,}[A-Z0-9_/-]*\d{3,}[A-Z0-9_/-]*)/i);
  if (ref) set('reference', ref.value, ref.excerpt);
  const party = grab(t, /(?:pouvoir adjudicateur|acheteur public|entit[ée] adjudicatrice|ma[îi]tre d.ouvrage|the employer|employer|client)\s*(?::|est)\s*([^\n]{3,120})/i);
  if (party) set('counterparty', clean(party.value), party.excerpt);

  const amount = grab(t, new RegExp(String.raw`(?:montant\s+(?:total\s+)?(?:du\s+(?:march[ée]|contrat|accord[- ]cadre)\s+)?(?:hors\s+taxes?|H\.?T\.?)|prix\s+global\s+(?:et\s+)?forfaitaire[^\n]{0,30}|accepted contract amount|contract price)[^\d\n]{0,40}${AMOUNT}`, 'i'));
  if (amount) set('amount', parseAmount(amount.value), amount.excerpt);
  const counts = Object.entries({
    EUR: /€|\bEUR\b|euros?\b/gi,
    USD: /\bUSD\b|US\$|dollars?\b/gi,
    GBP: /\bGBP\b|£|pounds?\s+sterling/gi,
    DZD: /\bDZD\b|dinars?\s+alg[ée]riens?/gi,
    MAD: /\bMAD\b|dirhams?\b/gi,
    CHF: /\bCHF\b|francs?\s+suisses?/gi,
  }).map(([cur, re]) => [cur, (t.match(re) ?? []).length]).sort((a, b) => b[1] - a[1]);
  if (counts[0][1] > 0) set('currency', counts[0][0], null);

  for (const [field, re] of [
    ['signature_date', String.raw`(?:sign[ée]\s+le|fait\s+[àa]\s+[^\n,]{2,30},?\s+le|date\s+de\s+signature|signed\s+on)\s*:?\s*${DATE}`],
    ['notification_date', String.raw`(?:notifi[ée]\s+le|date\s+de\s+notification)\s*:?\s*${DATE}`],
    ['start_date', String.raw`(?:date\s+de\s+(?:d[ée]marrage|commencement|d[ée]but)|commencement\s+date|starting\s+date|d[ée]marrage\s+des\s+travaux)\s*:?\s*${DATE}`],
    ['completion_date', String.raw`(?:completion\s+date|date\s+d.ach[èe]vement|date\s+de\s+fin(?:\s+des\s+travaux)?|time\s+for\s+completion)\s*:?\s*${DATE}`],
  ]) {
    const g = grab(t, new RegExp(re, 'i'));
    if (g) set(field, parseDate(g.value), g.excerpt);
  }
  const duration = grab(t, /d[ée]lai\s+(?:global\s+)?d.ex[ée]cution[^\n\d]{0,40}(\d{1,3})\s*(mois|semaines|jours)/i);
  if (duration) {
    sources.completion_date ??= duration.excerpt;
    values._duration = duration.value + ' ' + t.match(/d[ée]lai\s+(?:global\s+)?d.ex[ée]cution[^\n\d]{0,40}\d{1,3}\s*(mois|semaines|jours)/i)[1];
  }

  const pay = grab(t, /d[ée]lai\s+(?:global\s+)?de\s+paiement[^\d\n]{0,40}(\d{2,3})\s*jours/i) ?? grab(t, /(?:within|dans\s+un\s+d[ée]lai\s+de)\s+(\d{2,3})\s+days?\s+after[^\n]{0,40}statement/i);
  if (pay) set('payment_days', Number(pay.value), pay.excerpt);
  const ret = grab(t, /(?:retenue\s+de\s+garantie|retention(?:\s+money)?)[^\d\n]{0,60}(\d{1,2}(?:[.,]\d+)?)\s*%/i);
  if (ret) set('retention_percent', parseAmount(ret.value), ret.excerpt);
  const adv = grab(t, /\bavance\b[^\n]{0,80}?(\d{1,2}(?:[.,]\d+)?)\s*%/i);
  if (adv && values.amount) set('advance_amount', Math.round((values.amount * parseAmount(adv.value)) / 100), adv.excerpt);
  const pen = grab(t, /((?:p[ée]nalit[ée]s?\s+(?:de\s+retard|journali[èe]res?)|delay\s+damages)[^\n]{0,180})/i);
  if (pen) set('penalty_terms', clean(pen.value).slice(0, 200), pen.excerpt);
  const visa = grab(t, /d[ée]lai\s+(?:de\s+)?visa[^\d\n]{0,30}(\d{1,3})\s*jours/i);
  if (visa) set('visa_days', Number(visa.value), visa.excerpt);
  if (/groupement\s+solidaire/i.test(t)) set('group_type', 'solidaire', null);
  else if (/groupement\s+conjoint/i.test(t)) set('group_type', 'conjoint', null);

  const rev = grab(t, /((?:r[ée]vision|actualisation|ajustement)\s+des\s+prix[^\n]{0,200})/i);
  if (rev) set('price_revision', clean(rev.value).slice(0, 200), rev.excerpt);
  const formula = detectFormula(t);
  if (formula) for (const [k, v] of Object.entries(formula)) if (v !== null) set(k, v, k === 'rev_terms' ? rev?.excerpt : null);

  return { values, sources };
}

/** Schéma demandé à l'IA (toutes les valeurs facultatives : chaîne vide si absente). */
export const CONTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'reference', 'framework', 'counterparty', 'project', 'amount', 'currency', 'signature_date', 'start_date', 'completion_date', 'payment_days', 'retention_percent', 'penalty_terms', 'price_revision', 'agreement_type', 'min_amount', 'max_amount', 'evidence'],
  properties: {
    title: { type: 'string' },
    reference: { type: 'string' },
    framework: { type: 'string', enum: ['', 'NEC4', 'NEC3', 'FR_PUBLIC', 'FR_PRIVE', 'COMMERCIAL', 'FIDIC_RED_2017', 'FIDIC_YELLOW_2017', 'FIDIC_SILVER_2017', 'FIDIC_RED_1999', 'FIDIC_YELLOW_1999', 'FIDIC_SILVER_1999'] },
    counterparty: { type: 'string' },
    project: { type: 'string' },
    amount: { type: 'number' },
    currency: { type: 'string' },
    signature_date: { type: 'string' },
    start_date: { type: 'string' },
    completion_date: { type: 'string' },
    payment_days: { type: 'number' },
    retention_percent: { type: 'number' },
    penalty_terms: { type: 'string' },
    price_revision: { type: 'string' },
    agreement_type: { type: 'string', enum: ['', 'bons_commande', 'marches_subsequents', 'mixte', 'contrat_cadre'] },
    min_amount: { type: 'number' },
    max_amount: { type: 'number' },
    evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['field', 'excerpt'], properties: { field: { type: 'string' }, excerpt: { type: 'string' } } } },
  },
};

/** Fusionne la proposition de l'IA (prioritaire quand elle donne une valeur plausible) avec les règles. */
export function mergeAi(rules, ai) {
  const values = { ...rules.values };
  const sources = { ...rules.sources };
  const fromAi = [];
  for (const [k, v] of Object.entries(ai ?? {})) {
    if (k === 'evidence' || v === '' || v === null || v === 0 || v === undefined) continue;
    if (/_date$/.test(k) && !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
    values[k] = v;
    fromAi.push(k);
  }
  for (const e of ai?.evidence ?? []) if (e.field && e.excerpt) sources[e.field] = e.excerpt.slice(0, 220);
  return { values, sources, fromAi };
}
