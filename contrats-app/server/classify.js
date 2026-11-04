// Classement automatique de la correspondance : thème et criticité, avec les raisons retenues.
// Règles sur l'objet et le contenu ; l'analyse IA (« Analyser avec l'IA ») peut ensuite affiner.

export const CORR_THEMES = [
  'Réclamation / différend',
  'Mise en demeure / pénalités',
  'Délais / planning',
  'Paiement / facturation',
  'Ordre de service / instruction',
  'Modification / avenant',
  'Notification contractuelle',
  'Technique / visa',
  'Qualité / réserves',
  'Sécurité / environnement',
  'Réunion / compte rendu',
  'Administratif',
];
export const CRITICALITIES = ['critique', 'haute', 'moyenne', 'faible'];

// Ordre = priorité : le premier thème reconnu l'emporte.
const THEME_RULES = [
  ['Mise en demeure / pénalités', /mise en demeure|p[ée]nalit[ée]s?|r[ée]siliation|d[ée]ch[ée]ance|formal notice|delay damages|termination/i],
  ['Réclamation / différend', /r[ée]clamation|m[ée]moire en r[ée]clamation|diff[ée]rend|contestation|litige|claim|dispute|DAAB|CCRA|contentieux|recours/i],
  ['Ordre de service / instruction', /ordre de service|\bOS\s?n?°?\s?\d|instruction|injonction|engineer.s instruction/i],
  ['Modification / avenant', /avenant|modification|variation|travaux suppl[ée]mentaires|prix nouveaux?|devis|quotation/i],
  ['Notification contractuelle', /early warning|compensation event|notice of claim|notification|avertissement anticip[ée]/i],
  ['Délais / planning', /d[ée]lai|planning|programme|retard|prolongation|calendrier|extension of time|jalon|key date|completion/i],
  ['Paiement / facturation', /facture|situation|paiement|acompte|d[ée]compte|r[èe]glement|retenue de garantie|avance|invoice|payment|statement|int[ée]r[êe]ts moratoires/i],
  ['Technique / visa', /visa|plan|note de calcul|fiche technique|[ée]tude|PAQ|submittal|drawing|technique|VSO|VAO/i],
  ['Qualité / réserves', /r[ée]serves?|non[- ]conformit[ée]|malfa[çc]on|d[ée]faut|qualit[ée]|r[ée]ception|lev[ée]e|punch list|NCR/i],
  ['Sécurité / environnement', /s[ée]curit[ée]|accident|incident|HSE|PPSPS|environnement|pollution|CSPS|safety/i],
  ['Réunion / compte rendu', /compte[- ]rendu|r[ée]union|convocation|ordre du jour|minutes|meeting|\bCR\b/i],
];

const CRITICAL = /mise en demeure|r[ée]siliation|forclusion|d[ée]ch[ée]ance|contentieux|tribunal|arbitrage|accident|sinistre|suspension des travaux|formal notice|termination|time[- ]barred/i;
const HIGH = /p[ée]nalit[ée]s?|r[ée]clamation|r[ée]serves?|refus|rejet|retard|ordre de service|notice of claim|early warning|compensation event|urgent|imm[ée]diat|sous \d{1,2} (?:jours|days)|dans les? \d{1,2} (?:jours|days)|non[- ]conformit[ée]|diff[ée]rend|DAAB|dispute/i;
const LOW = /compte[- ]rendu|\bCR\b|r[ée]union|minutes|pour information|\bPI\b|convocation|accus[ée] de r[ée]ception|transmission de|bordereau|newsletter/i;

/** @returns {{ theme: string, criticality: string, reasons: string[] }} */
export function classifyCorrespondence({ subject = '', summary = '', text = '', type = '', direction, response_required, response_due } = {}) {
  const head = `${type} ${subject}`;
  const all = `${head}\n${summary ?? ''}\n${(text ?? '').slice(0, 20000)}`;
  const reasons = [];
  // Thème : d'abord sur l'objet (plus fiable), puis sur le contenu.
  let theme = THEME_RULES.find(([, re]) => re.test(head))?.[0] ?? THEME_RULES.find(([, re]) => re.test(all))?.[0] ?? 'Administratif';

  let criticality = 'moyenne';
  const crit = all.match(CRITICAL);
  const high = all.match(HIGH);
  if (crit) {
    criticality = 'critique';
    reasons.push(`« ${crit[0]} »`);
  } else if (high) {
    criticality = 'haute';
    reasons.push(`« ${high[0]} »`);
  } else if (LOW.test(head) && !response_required) {
    criticality = 'faible';
    reasons.push('pour information');
  }
  if (response_required) {
    reasons.push('réponse attendue');
    const days = response_due ? (Date.parse(response_due) - Date.now()) / 86400000 : null;
    if (days !== null && days <= 7 && criticality !== 'critique') {
      criticality = 'haute';
      reasons.push('échéance sous 7 jours');
    } else if (criticality === 'faible') criticality = 'moyenne';
  }
  if (type === 'Mise en demeure') {
    criticality = 'critique';
    theme = 'Mise en demeure / pénalités';
  }
  if (direction === 'sortant' && criticality === 'moyenne' && !response_required) criticality = 'faible';
  return { theme, criticality, reasons };
}
