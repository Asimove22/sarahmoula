// Droit français des marchés publics : Code de la commande publique (CCP) et CCAG 2021.
// Chaque règle cite sa source. « verify » signale une règle que le CCAP peut modifier ou dont la
// référence précise est à contrôler dans le texte applicable : l'interface l'affiche comme telle.
import { addDays, today } from './deadlines.js';

export const CCAG = {
  TRAVAUX_2021: { label: 'CCAG Travaux 2021', family: 'travaux' },
  FCS_2021: { label: 'CCAG Fournitures courantes et services 2021', family: 'fcs' },
  MOE_2021: { label: 'CCAG Maîtrise d’œuvre 2021', family: 'moe' },
  PI_2021: { label: 'CCAG Prestations intellectuelles 2021', family: 'pi' },
  TIC_2021: { label: 'CCAG Techniques de l’information et de la communication 2021', family: 'tic' },
  MI_2021: { label: 'CCAG Marchés industriels 2021', family: 'mi' },
};

export const BUYERS = {
  etat: { label: 'État et ses établissements publics', paymentDays: 30 },
  collectivite: { label: 'Collectivité territoriale ou établissement public local', paymentDays: 30 },
  sante: { label: 'Établissement public de santé', paymentDays: 50 },
  entreprise_publique: { label: 'Entreprise publique', paymentDays: 60 },
};

const isPublic = (c) => c?.framework === 'FR_PUBLIC';
const family = (c) => CCAG[c?.ccag]?.family ?? null;
const isWorks = (c) => family(c) === 'travaux';

export const OS_RESERVE_DAYS = 15;
export const CLAIM_MONTHS = 2;

export function addMonths(iso, months) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 31 janvier + 1 mois = fin février
  return d.toISOString().slice(0, 10);
}

/** Délai global de paiement : celui du contrat, sinon le délai légal selon l'acheteur. */
export function legalPaymentDays(c) {
  return BUYERS[c.buyer_type]?.paymentDays ?? 30;
}

/** Intérêts moratoires : taux BCE + 8 points, au prorata des jours de retard, + indemnité forfaitaire de 40 €. */
export function lateInterest({ amount, dueDate, paidDate, ecbRate }) {
  if (!amount || !dueDate) return null;
  const end = paidDate || today();
  const days = Math.round((Date.parse(end) - Date.parse(dueDate)) / 86400000);
  if (days <= 0) return null;
  const rate = ecbRate === null || ecbRate === undefined || ecbRate === '' ? null : Number(ecbRate) + 8;
  return {
    days,
    rate,
    interest: rate === null ? null : Math.round(amount * (rate / 100) * (days / 365) * 100) / 100,
    flat_fee: 40,
  };
}

/** Référentiel applicable au contrat, pour l'onglet « Marché public ». */
export function referential(c, settings = {}) {
  if (!isPublic(c)) return [];
  const works = isWorks(c);
  const ccagLabel = CCAG[c.ccag]?.label ?? 'CCAG applicable (non renseigné)';
  const rules = [
    {
      theme: 'Paiement',
      title: 'Délai global de paiement',
      value: `${legalPaymentDays(c)} jours${c.buyer_type ? ` (${BUYERS[c.buyer_type].label})` : ' (30 j par défaut ; 50 j établissements publics de santé ; 60 j entreprises publiques)'}`,
      source: 'Code de la commande publique, art. R2192-10 et R2192-11',
    },
    {
      theme: 'Paiement',
      title: 'Intérêts moratoires en cas de retard de paiement',
      value: `Taux de la BCE + 8 points${settings.ecb_rate ? ` (soit ${(Number(settings.ecb_rate) + 8).toFixed(2)} % avec le taux BCE saisi)` : ' (saisir le taux BCE dans Paramètres)'}, dus de plein droit, plus une indemnité forfaitaire de 40 € pour frais de recouvrement`,
      source: 'CCP, art. R2192-31 et D2192-35',
    },
    {
      theme: 'Garanties',
      title: 'Retenue de garantie',
      value: '5 % maximum du montant initial (et des avenants), remplaçable par une garantie à première demande ou une caution',
      source: 'CCP, art. R2191-32 à R2191-36',
    },
    {
      theme: 'Avance',
      title: 'Avance',
      value: 'Obligatoire si le montant dépasse 50 000 € HT et le délai d’exécution 2 mois, sauf renonciation du titulaire ; taux minimal de 5 % (taux supérieurs possibles, notamment pour les PME)',
      source: 'CCP, art. R2191-3 et R2191-7',
      verify: true,
    },
    {
      theme: 'Sous-traitance',
      title: 'Paiement direct des sous-traitants',
      value: 'Le sous-traitant de premier rang accepté et agréé est payé directement par l’acheteur dès 600 € TTC',
      source: 'CCP, art. R2193-10',
    },
    {
      theme: 'Modifications',
      title: 'Modification de faible montant',
      value: `Possible sans nouvelle procédure si elle reste sous les seuils européens et sous ${works ? '15 %' : '10 %'} du montant initial`,
      source: 'CCP, art. R2194-8',
    },
    {
      theme: 'Modifications',
      title: 'Modification rendue nécessaire par des circonstances imprévues',
      value: 'Chaque modification est limitée à 50 % du montant du marché initial',
      source: 'CCP, art. R2194-3',
    },
    {
      theme: 'Ordres de service',
      title: 'Réserves sur un ordre de service',
      value: `${OS_RESERVE_DAYS} jours à compter de la réception de l’OS pour émettre des réserves motivées, faute de quoi l’OS est réputé accepté`,
      source: works ? 'CCAG Travaux 2021, art. 3.8' : `${ccagLabel}, article relatif aux ordres de service`,
      verify: !works,
    },
    {
      theme: 'Différends',
      title: 'Mémoire en réclamation',
      value: `Le titulaire transmet un mémoire en réclamation dans les ${CLAIM_MONTHS} mois qui suivent l’apparition du différend ; l’acheteur dispose de ${CLAIM_MONTHS} mois pour répondre, son silence valant rejet`,
      source: works ? 'CCAG Travaux 2021, art. 55' : `${ccagLabel}, article relatif au règlement des différends`,
      verify: true,
    },
  ];
  if (works) {
    rules.push(
      {
        theme: 'Pénalités',
        title: 'Pénalités de retard (règle par défaut)',
        value: '1/3000 du montant HT du marché par jour calendaire de retard, sauf stipulation contraire du CCAP',
        source: 'CCAG Travaux 2021, art. 19.2',
        verify: true,
      },
      {
        theme: 'Réception',
        title: 'Garantie de parfait achèvement',
        value: 'Un an à compter de la réception ; la retenue de garantie est remboursée au plus tard un mois après l’expiration du délai de garantie',
        source: 'CCAG Travaux 2021, art. 44 ; CCP, art. R2191-35',
      },
      {
        theme: 'Décompte',
        title: 'Projet de décompte final et décompte général',
        value: 'Le titulaire transmet son projet de décompte final après la réception ; une fois le décompte général notifié, il dispose de 30 jours pour le retourner signé, avec ou sans réserves, faute de quoi il est réputé accepté',
        source: 'CCAG Travaux 2021, art. 12',
        verify: true,
      },
      {
        theme: 'Réception',
        title: 'Garanties légales des constructeurs',
        value: 'Garantie biennale de bon fonctionnement (2 ans) et garantie décennale (10 ans) à compter de la réception',
        source: 'Code civil, art. 1792 à 1792-6',
      },
    );
  }
  return rules;
}

/** Dates dérivées des registres « marché public ». */
export function serviceOrderDue(os) {
  return os.reserves_due || addDays(os.received_date || os.issued_date, OS_RESERVE_DAYS);
}
export function claimDates(cl) {
  return {
    memo_due: cl.memo_due || addMonths(cl.dispute_date, CLAIM_MONTHS),
    response_due: cl.response_due || addMonths(cl.memo_sent_date, CLAIM_MONTHS),
  };
}
export const directPaymentRequired = (s, c) => s.amount_ht != null && s.amount_ht * (1 + (c.amount_ttc_rate ?? 20) / 100) >= 600;

export function derivePublic(table, row, c) {
  if (table === 'service_orders') {
    const due = serviceOrderDue(row);
    return { ...row, computed_reserves_due: due, overdue: Boolean(due && !row.reserves_date && row.status === 'reçu' && due < today()) };
  }
  if (table === 'claims') return { ...row, ...Object.fromEntries(Object.entries(claimDates(row)).map(([k, v]) => [`computed_${k}`, v])) };
  if (table === 'subcontractors') return { ...row, direct_payment_required: directPaymentRequired(row, c) };
  return row;
}

/** Échéances liées au droit des marchés publics (même format que computeDeadlines). */
export function publicDeadlines(db, contracts) {
  const items = [];
  const push = (c, item) => item.date && items.push({ ...item, contract_id: c.id, contract_title: c.title, contract_reference: c.reference });
  for (const c of contracts) {
    if (!isPublic(c) || ['clôturé', 'résilié', 'archivé', 'brouillon'].includes(c.status)) continue;
    for (const os of db.prepare("SELECT * FROM service_orders WHERE contract_id = ? AND status = 'reçu' AND reserves_date IS NULL").all(c.id)) {
      push(c, { kind: 'marché public', entity: 'service_orders', entity_id: os.id, date: serviceOrderDue(os), title: `Réserves sur l’OS ${os.number ?? ''} : ${os.title}`, critical: true });
    }
    for (const cl of db.prepare("SELECT * FROM claims WHERE contract_id = ? AND status NOT IN ('clos', 'abandonné')").all(c.id)) {
      const d = claimDates(cl);
      if (!cl.memo_sent_date) push(c, { kind: 'marché public', entity: 'claims', entity_id: cl.id, date: d.memo_due, title: `Mémoire en réclamation ${cl.number ?? ''} à transmettre : ${cl.title}`, critical: true });
      else if (!cl.response_date) push(c, { kind: 'marché public', entity: 'claims', entity_id: cl.id, date: d.response_due, title: `Réponse de l’acheteur au mémoire ${cl.number ?? ''} (silence = rejet)` });
    }
    if (isWorks(c) && c.reception_date && !c.final_account_sent_date) {
      push(c, { kind: 'marché public', entity: 'contracts', entity_id: c.id, date: addDays(c.reception_date, 30), title: 'Transmettre le projet de décompte final', critical: true });
    }
    if (c.dgd_notified_date && !c.dgd_signed_date) {
      push(c, { kind: 'marché public', entity: 'contracts', entity_id: c.id, date: addDays(c.dgd_notified_date, 30), title: 'Retourner le décompte général signé (réserves éventuelles), sinon il est réputé accepté', critical: true });
    }
    if (isWorks(c) && c.reception_date && c.retention_percent) {
      push(c, { kind: 'marché public', entity: 'contracts', entity_id: c.id, date: addMonths(addDays(c.reception_date, 365), 1), title: 'Remboursement de la retenue de garantie (au plus tard 1 mois après la fin de la garantie)' });
    }
  }
  return items;
}

/** Points d'attention propres aux marchés publics. */
export function publicInsights(db, c, { add, finance, latestImport, settings }) {
  if (!isPublic(c)) return;
  const now = today();
  if (!c.ccag) add('attention', 'CCAG applicable non renseigné', 'Indiquez le CCAG visé par le CCAP (Travaux, FCS, MOE, PI, TIC, MI) pour activer les règles correspondantes.', 'marche');
  if (!c.buyer_type) add('info', 'Type d’acheteur non renseigné', 'Il détermine le délai global de paiement légal (30, 50 ou 60 jours).', 'marche');
  if (c.retention_percent > 5) add('critique', `Retenue de garantie de ${c.retention_percent} % : au-delà du plafond légal de 5 %`, 'CCP, art. R2191-32.', 'finances');
  if (c.payment_days && c.payment_days > legalPaymentDays(c)) add('attention', `Délai de paiement de ${c.payment_days} j supérieur au délai légal de ${legalPaymentDays(c)} j`, 'Une clause fixant un délai plus long est sans effet : le délai légal s’applique (CCP, art. R2192-10 et suivants).', 'finances');

  const span = c.start_date && (c.completion_date || c.end_date) ? (Date.parse(c.completion_date || c.end_date) - Date.parse(c.start_date)) / 86400000 : null;
  if (c.amount > 50000 && span !== null && span > 61 && !c.advance_amount) add('info', 'Avance non renseignée', 'Montant > 50 000 € HT et délai > 2 mois : l’avance est en principe obligatoire, sauf renonciation (CCP, art. R2191-3). Vérifiez l’acte d’engagement.', 'finances');

  if (finance && c.amount) {
    const threshold = isWorks(c) ? 15 : 10;
    if (finance.variation_percent !== null && finance.amendments_signed > 0 && (finance.amendments_signed / c.amount) * 100 > threshold)
      add('attention', `Avenants cumulés : +${((finance.amendments_signed / c.amount) * 100).toFixed(1)} % du montant initial`, `Au-delà de ${threshold} %, la modification ne relève plus du « faible montant » (CCP, art. R2194-8) et doit se fonder sur un autre cas de modification.`, 'finances');
    const big = db.prepare("SELECT * FROM amendments WHERE contract_id = ? AND status != 'refusé' AND amount > ?").all(c.id, c.amount / 2);
    for (const a of big) add('critique', `Avenant ${a.number} supérieur à 50 % du montant initial`, 'Pour une modification due à des circonstances imprévues, chaque modification est plafonnée à 50 % (CCP, art. R2194-3).', 'finances');
  }

  for (const s of db.prepare('SELECT * FROM subcontractors WHERE contract_id = ?').all(c.id)) {
    if (!s.approval_date && s.status !== 'refusé') add('attention', `Sous-traitant ${s.company} non agréé`, 'Il ne peut pas intervenir avant l’acceptation et l’agrément de ses conditions de paiement par l’acheteur (DC4).', 'marche');
    if (directPaymentRequired(s, c) && s.direct_payment === 0) add('attention', `Paiement direct obligatoire pour ${s.company}`, 'Montant ≥ 600 € TTC : le sous-traitant de premier rang a droit au paiement direct (CCP, art. R2193-10).', 'marche');
  }

  for (const os of db.prepare("SELECT * FROM service_orders WHERE contract_id = ? AND status = 'reçu' AND reserves_date IS NULL").all(c.id)) {
    const due = serviceOrderDue(os);
    if (due && due >= now && Date.parse(due) - Date.parse(now) <= 5 * 86400000)
      add('critique', `OS ${os.number} : réserves à émettre avant le ${due}`, 'Passé ce délai, l’ordre de service est réputé accepté sans réserve.', 'marche', { open: os.id, letter: 'os_reserves' });
  }

  // Estimation des pénalités si le planning dépasse la date contractuelle (règle par défaut du CCAG Travaux).
  const end = c.completion_date || c.end_date;
  if (isWorks(c) && c.amount && latestImport?.planned_completion && end && latestImport.planned_completion > end) {
    const days = Math.round((Date.parse(latestImport.planned_completion) - Date.parse(end)) / 86400000);
    const penalty = Math.round((c.amount / 3000) * days);
    add('info', `Pénalités théoriques : ${penalty.toLocaleString('fr-FR')} € pour ${days} j de retard`, 'Règle par défaut du CCAG Travaux 2021 (1/3000 du montant HT par jour), sauf CCAP contraire, hors plafond éventuel et causes exonératoires. Les retards non imputables doivent être documentés.', 'marche');
  }

  if (settings && !settings.ecb_rate && db.prepare('SELECT COUNT(*) AS n FROM payments WHERE contract_id = ? AND paid_date IS NULL').get(c.id).n)
    add('info', 'Taux BCE non renseigné', 'Saisissez-le dans Paramètres pour chiffrer automatiquement les intérêts moratoires des paiements en retard.', 'finances');
}

/** Points de contrôle de la revue de contrat selon le CCAG. */
export const CCAG_REVIEW = {
  COMMON: [
    ['Pièces contractuelles', 'Ordre de priorité des pièces, dérogations au CCAG récapitulées en fin de CCAP'],
    ['Prix', 'Forme des prix (forfaitaires, unitaires), variation des prix : révision (index, clause butoir) ou actualisation'],
    ['Avance', 'Taux, versement, remboursement ; garantie à première demande éventuelle'],
    ['Paiement', 'Acomptes, délai global de paiement, intérêts moratoires (CCP R2192-10 et suivants)'],
    ['Retenue de garantie', 'Taux (≤ 5 %), substitution par garantie à première demande ou caution'],
    ['Pénalités', 'Pénalités de retard et autres pénalités, plafond, exonérations'],
    ['Sous-traitance', 'DC4, paiement direct, délais d’agrément'],
    ['Modifications', 'Cas de modification prévus (clauses de réexamen), seuils R2194-8'],
    ['Résiliation', 'Motifs, indemnisation, résiliation pour motif d’intérêt général'],
    ['Différends', 'Mémoire en réclamation, médiation, CCRA, juridiction compétente'],
    ['Assurances', 'Responsabilité civile, garanties exigées'],
  ],
  travaux: [
    ['Ordres de service', 'Délai de réserves sur OS, OS à incidence financière'],
    ['Préparation', 'Période de préparation, PAQ, PPSPS, plans d’exécution et délai de visa'],
    ['Délais', 'Délai d’exécution, prolongations (intempéries, travaux supplémentaires)'],
    ['Réception', 'OPR, réception avec réserves, levée des réserves'],
    ['Décompte', 'Projet de décompte final, décompte général, délais de contestation'],
    ['Garanties', 'Parfait achèvement, biennale, décennale ; assurance dommages-ouvrage'],
  ],
  fcs: [
    ['Livraison', 'Lieux, délais, conditionnement, transfert de propriété et des risques'],
    ['Admission', 'Opérations de vérification quantitatives et qualitatives, décisions d’admission, réfaction, rejet'],
    ['Garantie', 'Garantie des prestations, durée, point de départ'],
  ],
  moe: [
    ['Éléments de mission', 'Missions de base et complémentaires, délais de remise des documents'],
    ['Coût prévisionnel', 'Engagement sur le coût prévisionnel, seuil de tolérance, conséquences d’un dépassement'],
    ['Approbation', 'Délais d’approbation des études par le maître d’ouvrage'],
    ['Rémunération', 'Forfait provisoire / définitif, modifications de programme'],
  ],
  pi: [
    ['Propriété intellectuelle', 'Option retenue pour les droits sur les résultats, droits de l’acheteur et du titulaire'],
    ['Livrables', 'Contenu, délais de remise, vérification et admission'],
    ['Confidentialité', 'Obligations de confidentialité et de sécurité'],
  ],
  tic: [
    ['Vérifications', 'Vérification d’aptitude, vérification de service régulier'],
    ['Propriété intellectuelle', 'Logiciels spécifiques et standards, licences'],
    ['Maintenance et réversibilité', 'Niveaux de service, pénalités, plan de réversibilité'],
    ['Données', 'Protection des données personnelles, sécurité, hébergement'],
  ],
  mi: [
    ['Fabrication', 'Surveillance de la fabrication, contrôles en usine'],
    ['Essais et admission', 'Essais, réception, admission'],
    ['Garantie', 'Garantie technique, pièces de rechange, maintenance'],
  ],
};

export function publicReviewTemplate(c) {
  return [...CCAG_REVIEW.COMMON, ...(CCAG_REVIEW[family(c)] ?? [])];
}
