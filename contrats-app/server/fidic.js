// Contrats FIDIC (éditions 1999 et 2017 : Red, Yellow, Silver) et accords-cadres / contrats-cadres.
// Les délais sont ceux des Conditions générales ; les Particular Conditions peuvent les modifier :
// chaque règle le signale (« verify ») et les délais de claims sont réglables dans la fiche contrat.
import { addDays, today } from './deadlines.js';
import { addMonths } from './legal.js';

export const FIDIC_BOOKS = {
  FIDIC_RED_2017: { label: 'FIDIC Red Book 2017 (Construction)', edition: 2017, design: false },
  FIDIC_YELLOW_2017: { label: 'FIDIC Yellow Book 2017 (Plant & Design-Build)', edition: 2017, design: true },
  FIDIC_SILVER_2017: { label: 'FIDIC Silver Book 2017 (EPC / Turnkey)', edition: 2017, design: true, epc: true },
  FIDIC_RED_1999: { label: 'FIDIC Red Book 1999 (Construction)', edition: 1999, design: false },
  FIDIC_YELLOW_1999: { label: 'FIDIC Yellow Book 1999 (Plant & Design-Build)', edition: 1999, design: true },
  FIDIC_SILVER_1999: { label: 'FIDIC Silver Book 1999 (EPC / Turnkey)', edition: 1999, design: true, epc: true },
};
export const isFidic = (c) => Boolean(FIDIC_BOOKS[c?.framework]);
const book = (c) => FIDIC_BOOKS[c.framework];
const engineer = (c) => (book(c).epc ? 'Employer' : 'Engineer');

/** Délais de claims : Particular Conditions (fiche contrat), sinon Conditions générales de l'édition. */
export function fidicPeriods(c) {
  const e2017 = book(c).edition === 2017;
  return {
    notice: c.fidic_notice_days ?? 28, // 20.2.1 (2017) / 20.1 (1999)
    detailed: c.fidic_detailed_days ?? (e2017 ? 84 : 42), // 20.2.4 / 20.1
    response: c.fidic_response_days ?? 42, // 20.2.5 / 20.1
    payment: c.payment_days ?? 56, // 14.7
  };
}

export function fidicClaimDates(cl, c) {
  const p = fidicPeriods(c);
  return {
    notice_due: addDays(cl.dispute_date, p.notice),
    memo_due: cl.memo_due || addDays(cl.dispute_date, p.detailed),
    response_due: cl.response_due || addDays(cl.memo_sent_date, p.response),
  };
}

export function fidicReferential(c) {
  if (!isFidic(c)) return [];
  const b = book(c);
  const p = fidicPeriods(c);
  const e2017 = b.edition === 2017;
  const eng = engineer(c);
  const cl = (n17, n99) => (e2017 ? n17 : n99);
  return [
    { theme: 'Claims', title: 'Notice of Claim', value: `${p.notice} jours après que la Partie a eu (ou aurait dû avoir) connaissance de l’événement. Faute de notice dans ce délai, le claim est forclos (time-bar).`, source: `${b.label}, cl. ${cl('20.2.1', '20.1')}`, verify: true },
    { theme: 'Claims', title: 'Fully detailed Claim', value: `${p.detailed} jours après la connaissance de l’événement${e2017 ? ', avec la base contractuelle (sinon la notice devient caduque, cl. 20.2.4)' : ''}. Mises à jour mensuelles si l’événement se poursuit.`, source: `${b.label}, cl. ${cl('20.2.4', '20.1')}`, verify: true },
    { theme: 'Claims', title: `Réponse de l’${eng}`, value: `${p.response} jours après réception du fully detailed Claim${e2017 ? ', puis Determination (cl. 3.7)' : ''}.`, source: `${b.label}, cl. ${cl('20.2.5 / 3.7', '20.1 / 3.5')}`, verify: true },
    ...(e2017
      ? [
          { theme: 'Litiges', title: 'Notice of Dissatisfaction (NOD)', value: '28 jours après la Determination, faute de quoi elle devient définitive et obligatoire.', source: `${b.label}, cl. 3.7.5`, verify: true },
          { theme: 'Litiges', title: 'Saisine du DAAB', value: '42 jours après l’envoi ou la réception de la NOD, sinon la NOD devient caduque. Décision du DAAB sous 84 jours.', source: `${b.label}, cl. 21.4`, verify: true },
          { theme: 'Litiges', title: 'Contestation de la décision du DAAB', value: 'NOD sur la décision du DAAB dans les 28 jours, puis règlement amiable (28 jours) avant arbitrage.', source: `${b.label}, cl. 21.4.4 / 21.5 / 21.6`, verify: true },
          { theme: 'Délais', title: 'Avertissement anticipé (Advance warning)', value: 'Chaque Partie avertit l’autre des événements pouvant affecter le travail, le prix ou le délai.', source: `${b.label}, cl. 8.4`, verify: false },
        ]
      : [{ theme: 'Litiges', title: 'Saisine du DAB et contestation', value: 'Décision du DAB sous 84 jours ; notice of dissatisfaction dans les 28 jours, puis règlement amiable (56 jours) avant arbitrage.', source: `${b.label}, cl. 20.4 / 20.5`, verify: true }]),
    { theme: 'Programme', title: 'Programme initial', value: `28 jours après la notice de Commencement ; l’${eng} dispose de 21 jours pour le commenter${e2017 ? ' (programme révisé dès qu’il ne reflète plus l’avancement)' : ''}.`, source: `${b.label}, cl. 8.3`, verify: true },
    { theme: 'Paiement', title: 'Interim Payment Certificate', value: b.epc ? 'Pas d’Engineer : l’Employer peut notifier son désaccord sur le Statement dans les 28 jours.' : 'L’Engineer émet l’IPC dans les 28 jours suivant la réception du Statement.', source: `${b.label}, cl. 14.6`, verify: true },
    { theme: 'Paiement', title: 'Délai de paiement', value: `${p.payment} jours après réception du Statement par l’${eng} (paiements intermédiaires).`, source: `${b.label}, cl. 14.7`, verify: true },
    { theme: 'Paiement', title: 'Retard de paiement', value: 'Financing charges : taux d’escompte de la banque centrale du pays de la monnaie de paiement + 3 points, calculés mensuellement, sans mise en demeure.', source: `${b.label}, cl. 14.8`, verify: true },
    { theme: 'Garanties', title: 'Performance Security', value: '28 jours après réception de la Letter of Acceptance ; valable jusqu’à l’achèvement et la réparation des défauts.', source: `${b.label}, cl. 4.2`, verify: true },
    { theme: 'Réception', title: 'Taking-Over Certificate', value: `L’${eng} émet le certificat ou rejette la demande dans les 28 jours ; à défaut, les travaux sont réputés réceptionnés.`, source: `${b.label}, cl. 10.1`, verify: true },
    ...(b.design ? [{ theme: 'Conception', title: 'Documents du Contractor', value: `Période de revue de l’${eng} : 21 jours sauf stipulation contraire ; à défaut de réponse, document réputé sans objection (2017).`, source: `${b.label}, cl. 5.2`, verify: true }] : []),
    { theme: 'Variations', title: 'Variation et proposition', value: `Le Contractor transmet sa proposition (travaux, programme, prix) ; l’${eng} répond dès que possible. Les Variations ne peuvent être imposées sans instruction.`, source: `${b.label}, cl. 13.1 – 13.3`, verify: false },
  ];
}

/** Échéances FIDIC : notice of claim (forclusion), fully detailed claim, réponse, programme initial. */
export function fidicDeadlines(db, contracts) {
  const items = [];
  const push = (c, item) => item.date && items.push({ ...item, contract_id: c.id, contract_title: c.title, contract_reference: c.reference });
  for (const c of contracts) {
    if (!isFidic(c) || ['clôturé', 'résilié', 'archivé', 'brouillon'].includes(c.status)) continue;
    for (const cl of db.prepare("SELECT * FROM claims WHERE contract_id = ? AND status NOT IN ('clos', 'abandonné', 'accepté', 'rejeté')").all(c.id)) {
      const d = fidicClaimDates(cl, c);
      if (!cl.notice_date) push(c, { kind: 'FIDIC', entity: 'claims', entity_id: cl.id, date: d.notice_due, title: `Notice of Claim ${cl.number ?? ''} : ${cl.title} (forclusion)`, critical: true });
      if (!cl.memo_sent_date) push(c, { kind: 'FIDIC', entity: 'claims', entity_id: cl.id, date: d.memo_due, title: `Fully detailed Claim ${cl.number ?? ''} à transmettre`, critical: true });
      else if (!cl.response_date) push(c, { kind: 'FIDIC', entity: 'claims', entity_id: cl.id, date: d.response_due, title: `Réponse de l’${engineer(c)} au claim ${cl.number ?? ''}` });
    }
    if (c.start_date && !db.prepare('SELECT id FROM programmes WHERE contract_id = ? LIMIT 1').get(c.id)) {
      push(c, { kind: 'FIDIC', entity: 'contracts', entity_id: c.id, date: addDays(c.start_date, 28), title: 'Programme initial à soumettre (cl. 8.3)', critical: true });
    }
  }
  return items;
}

export function fidicInsights(db, c, { add }) {
  if (!isFidic(c)) return;
  const now = today();
  for (const cl of db.prepare("SELECT * FROM claims WHERE contract_id = ? AND status NOT IN ('clos', 'abandonné', 'accepté', 'rejeté')").all(c.id)) {
    const d = fidicClaimDates(cl, c);
    if (!cl.notice_date && d.notice_due && d.notice_due < now)
      add('critique', `${cl.number} : délai de Notice of Claim dépassé (${d.notice_due})`, 'Risque de forclusion (time-bar). Notifiez immédiatement et documentez la date de connaissance et les circonstances justifiant un dépassement (cl. 20.2.5, 2017).', 'marche', { open: cl.id, letter: 'fidic_notice_of_claim' });
    else if (!cl.notice_date && d.notice_due && Date.parse(d.notice_due) - Date.parse(now) <= 7 * 86400000)
      add('critique', `${cl.number} : Notice of Claim à envoyer avant le ${d.notice_due}`, 'Passé ce délai, le claim est forclos.', 'marche', { open: cl.id, letter: 'fidic_notice_of_claim' });
    if (cl.notice_date && !cl.memo_sent_date && d.memo_due && d.memo_due < now)
      add('critique', `${cl.number} : fully detailed Claim en retard (attendu le ${d.memo_due})`, 'En édition 2017, sans base contractuelle transmise dans le délai, la Notice of Claim est réputée caduque (cl. 20.2.4).', 'marche', { open: cl.id, letter: 'fidic_detailed_claim' });
  }
}

// ---------- Accords-cadres et contrats-cadres ----------
export const AGREEMENT_TYPES = {
  bons_commande: 'Accord-cadre à bons de commande',
  marches_subsequents: 'Accord-cadre à marchés subséquents',
  mixte: 'Accord-cadre mixte',
  contrat_cadre: 'Contrat-cadre (droit privé)',
};
export const isAgreement = (c) => Boolean(AGREEMENT_TYPES[c?.agreement_type]);
const ORDER_OPEN = "status NOT IN ('annulé')";

/** Consommation de l'accord-cadre : montant engagé par les bons de commande / marchés subséquents. */
export function agreementSummary(db, c) {
  if (!isAgreement(c)) return null;
  const rows = db.prepare(`SELECT * FROM orders WHERE contract_id = ? AND ${ORDER_OPEN}`).all(c.id);
  const committed = rows.reduce((s, o) => s + (o.amount ?? 0), 0);
  const invoiced = rows.filter((o) => ['facturé', 'soldé'].includes(o.status)).reduce((s, o) => s + (o.amount ?? 0), 0);
  const max = c.max_amount || null;
  return {
    type: AGREEMENT_TYPES[c.agreement_type],
    orders: rows.length,
    committed,
    invoiced,
    min: c.min_amount || null,
    max,
    consumption_percent: max ? (committed / max) * 100 : null,
    remaining: max ? max - committed : null,
  };
}

export function agreementInsights(db, c, { add }) {
  const s = agreementSummary(db, c);
  if (!s) return;
  const fmt = (n) => `${Math.round(n).toLocaleString('fr-FR')} ${c.currency || 'EUR'}`;
  if (!s.max && c.framework === 'FR_PUBLIC') add('attention', 'Accord-cadre sans montant maximum renseigné', 'Depuis 2021, un accord-cadre public doit fixer un maximum en valeur ou en quantité (CCP, art. R2121-8).', 'finances');
  if (s.consumption_percent !== null && s.consumption_percent >= 100)
    add('critique', `Maximum de l’accord-cadre atteint : ${s.consumption_percent.toFixed(0)} % (${fmt(s.committed)})`, 'Aucun nouveau bon de commande ne peut être émis au-delà du maximum : un nouvel accord-cadre ou une modification est nécessaire.', 'finances');
  else if (s.consumption_percent !== null && s.consumption_percent >= 80)
    add('attention', `Accord-cadre consommé à ${s.consumption_percent.toFixed(0)} %`, `Reste ${fmt(s.remaining)} avant le maximum : anticipez la suite (avenant, nouvelle consultation).`, 'finances');
  const end = c.end_date || c.completion_date;
  if (s.min && end && s.committed < s.min) {
    const left = (Date.parse(end) - Date.parse(today())) / 86400000;
    if (left <= 180) add('attention', `Minimum de l’accord-cadre non atteint (${fmt(s.committed)} sur ${fmt(s.min)})`, 'L’acheteur s’est engagé sur ce minimum : à défaut de commandes, une indemnisation peut être réclamée.', 'finances');
  }
  if (c.framework === 'FR_PUBLIC' && c.start_date && end && addMonths(c.start_date, 48) < end)
    add('attention', 'Durée de l’accord-cadre supérieure à 4 ans', 'Sauf cas justifiés, la durée est limitée à 4 ans (pouvoirs adjudicateurs) ou 8 ans (entités adjudicatrices) – CCP, art. L2125-1 et R2162-4.', 'synthese');
  for (const o of db.prepare("SELECT * FROM orders WHERE contract_id = ? AND status IN ('émis', 'en cours') AND due_date IS NOT NULL AND due_date < ?").all(c.id, today()))
    add('attention', `${o.number} : délai d’exécution dépassé (${o.due_date})`, o.title, 'finances', { open: o.id });
}

export function agreementDeadlines(db, contracts) {
  const items = [];
  for (const c of contracts) {
    if (!isAgreement(c)) continue;
    for (const o of db.prepare("SELECT * FROM orders WHERE contract_id = ? AND status IN ('émis', 'en cours') AND due_date IS NOT NULL").all(c.id))
      items.push({ kind: 'accord-cadre', entity: 'orders', entity_id: o.id, date: o.due_date, title: `${o.number} : fin d’exécution – ${o.title}`, contract_id: c.id, contract_title: c.title, contract_reference: c.reference });
  }
  return items;
}

/** Check-list de revue propre aux contrats FIDIC. */
export function fidicReviewTemplate(c) {
  const eng = engineer(c);
  return [
    ['Particular Conditions', 'Recenser toutes les modifications des Conditions générales (délais, plafonds, pénalités, DAAB).'],
    ['Claims', `Délais de Notice of Claim (28 j) et de fully detailed Claim : processus interne de détection et registre des événements.`],
    ['Délais', 'Time for Completion, Sections, Milestones, Delay Damages et leur plafond (Contract Data).'],
    ['Programme', 'Contenu exigé du programme (cl. 8.3), fréquence de mise à jour, float.'],
    ['Paiement', `Contenu des Statements, délai de l’IPC (28 j), paiement (56 j), monnaies, avance et son remboursement.`],
    ['Garanties', 'Performance Security, Advance Payment Guarantee, Retention Money et sa libération.'],
    ['Variations', `Procédure d’instruction par l’${eng}, Value Engineering, ajustements (cl. 13).`],
    ['Révision des prix', 'Formule d’ajustement (cl. 13.7 / Schedule of cost indexation) : indices, pondérations, base date.'],
    ['Responsabilités', 'Limitation de responsabilité (cl. 1.14 / 17.6), assurances (cl. 19), indemnités.'],
    ['Litiges', 'Composition et nomination du DAAB / DAB, siège et règlement d’arbitrage, droit applicable.'],
    ...(book(c).design ? [['Conception', 'Fitness for purpose, revue des Contractor’s Documents, Employer’s Requirements (erreurs, cl. 1.9 / 5.1).']] : []),
  ];
}

export const fidicPaymentDays = (c) => fidicPeriods(c).payment;
export { addMonths };
