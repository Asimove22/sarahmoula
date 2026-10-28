// Règles métier V2 : dates dérivées, synthèse financière et points d'attention proactifs.
import { addDays, ceDerived, today } from './deadlines.js';
import { getSettings } from './db.js';
import { legalPaymentDays, publicDeadlines, publicInsights, publicReviewTemplate } from './legal.js';

const NEC = new Set(['NEC3', 'NEC4']);
const FR = new Set(['FR_PUBLIC', 'FR_PRIVE']);
export const CLOSED_CONTRACT = ['clôturé', 'résilié', 'archivé'];
const CE_OPEN = (ce) => !['implémenté', 'rejeté', 'retiré'].includes(ce.status);

// Échéance : saisie, sinon délai du contrat, sinon délai légal (marchés publics) ou usuel (21 j en NEC).
export const paymentDue = (p, c) =>
  p.due_date || addDays(p.submitted_date, c.payment_days ?? (NEC.has(c.framework) ? 21 : c.framework === 'FR_PUBLIC' ? legalPaymentDays(c) : 30));
export const visaDue = (s, c) => s.visa_due || addDays(s.submitted_date, c.visa_days ?? 15);
export const programmeReplyDue = (p, c) => (p.submitted_date && !p.pm_response_date ? addDays(p.submitted_date, (c.pm_programme_reply_weeks ?? 2) * 7) : null);

/** Champs calculés ajoutés aux lignes des registres V2. */
export function derive(table, row, contract) {
  if (table === 'payments') {
    const due = paymentDue(row, contract);
    return { ...row, computed_due_date: due, overdue: Boolean(due && !row.paid_date && due < today()) };
  }
  if (table === 'submittals') {
    const due = visaDue(row, contract);
    return { ...row, computed_visa_due: due, overdue: Boolean(due && row.visa_status === 'en attente' && due < today()) };
  }
  if (table === 'programmes') return { ...row, pm_reply_due: programmeReplyDue(row, contract) };
  if (table === 'compensation_events') return { ...row, ...ceDerived(row, contract) };
  return row;
}

/** Échéances supplémentaires de la V2, au même format que computeDeadlines. */
export function extraDeadlines(db, contracts) {
  const items = [];
  const push = (c, item) => item.date && items.push({ ...item, contract_id: c.id, contract_title: c.title, contract_reference: c.reference });
  for (const c of contracts) {
    if (CLOSED_CONTRACT.includes(c.status) || c.status === 'brouillon') continue;
    const base = (entity, id) => ({ entity, entity_id: id });

    if (c.reception_date && FR.has(c.framework)) {
      push(c, { ...base('contracts', c.id), kind: 'contrat', date: addDays(c.reception_date, 365), title: 'Fin de la garantie de parfait achèvement (libération de la retenue de garantie)' });
      push(c, { ...base('contracts', c.id), kind: 'contrat', date: addDays(c.reception_date, 730), title: 'Fin de la garantie biennale de bon fonctionnement' });
    }

    const programmes = db.prepare('SELECT * FROM programmes WHERE contract_id = ? ORDER BY submitted_date').all(c.id);
    for (const p of programmes) {
      const due = programmeReplyDue(p, c);
      if (due) push(c, { ...base('programmes', p.id), kind: 'programme', date: due, title: `${p.number ?? 'Programme'} – réponse du PM attendue (cl. 31.3)` });
    }
    const last = programmes.filter((p) => p.submitted_date).at(-1);
    if (NEC.has(c.framework) && c.programme_interval_weeks && last) {
      push(c, { ...base('programmes', last.id), kind: 'programme', date: addDays(last.submitted_date, c.programme_interval_weeks * 7), title: 'Soumission du prochain programme révisé (cl. 32.2)', critical: true });
    }

    for (const s of db.prepare("SELECT * FROM submittals WHERE contract_id = ? AND visa_status = 'en attente'").all(c.id)) {
      push(c, { ...base('submittals', s.id), kind: 'visa', date: visaDue(s, c), title: `Visa attendu : ${s.number} ind. ${s.revision ?? 'A'} – ${s.title}` });
    }
    for (const p of db.prepare('SELECT * FROM payments WHERE contract_id = ? AND paid_date IS NULL').all(c.id)) {
      push(c, { ...base('payments', p.id), kind: 'paiement', date: paymentDue(p, c), title: `Paiement attendu : ${p.number ?? 'situation'}${p.period ? ` (${p.period})` : ''}`, critical: true });
    }
  }
  return [...items, ...publicDeadlines(db, contracts)];
}

const sum = (rows, f) => rows.reduce((n, r) => n + (Number(f(r)) || 0), 0);

export function financeSummary(db, contract) {
  const amendments = db.prepare('SELECT * FROM amendments WHERE contract_id = ?').all(contract.id);
  const ces = db.prepare('SELECT * FROM compensation_events WHERE contract_id = ?').all(contract.id);
  const payments = db.prepare('SELECT * FROM payments WHERE contract_id = ?').all(contract.id);
  const signed = amendments.filter((a) => a.status === 'signé');
  const initial = contract.amount ?? 0;
  const amendmentsTotal = sum(signed, (a) => a.amount);
  const ceImplemented = sum(ces.filter((c) => c.status === 'implémenté'), (c) => c.assessed_amount ?? c.quoted_amount);
  const current = initial + amendmentsTotal + ceImplemented;
  const invoiced = sum(payments, (p) => p.amount_validated ?? p.amount_requested);
  const paid = sum(payments, (p) => p.amount_paid);
  return {
    currency: contract.currency || 'EUR',
    initial,
    amendments_signed: amendmentsTotal,
    amendments_pending: sum(amendments.filter((a) => a.status === 'en négociation'), (a) => a.amount),
    extra_days: sum(signed, (a) => a.extra_days) + sum(ces.filter((c) => c.status === 'implémenté'), (c) => c.assessed_days ?? c.quoted_days),
    ce_implemented: ceImplemented,
    ce_exposure: sum(ces.filter(CE_OPEN), (c) => c.quoted_amount),
    current,
    variation_percent: initial ? ((current - initial) / initial) * 100 : null,
    invoiced,
    paid,
    outstanding: invoiced - paid,
    remaining_to_invoice: current - invoiced,
    progress_percent: current ? (invoiced / current) * 100 : null,
    retention: contract.retention_percent ? (invoiced * contract.retention_percent) / 100 : 0,
    overdue_payments: payments.filter((p) => !p.paid_date && paymentDue(p, contract) && paymentDue(p, contract) < today()).length,
  };
}

// Pièces de référence attendues selon le cadre contractuel (plusieurs libellés acceptés).
const REQUIRED_DOCS = {
  ALL: [['Contrat', 'Acte d’engagement']],
  NEC3: [['Contract Data', 'Contract Data / CCAP'], ['Scope / Works Information', 'CCTP', 'Annexe']],
  NEC4: [['Contract Data', 'Contract Data / CCAP'], ['Scope / Works Information', 'CCTP', 'Annexe']],
  FR_PUBLIC: [['CCAP', 'Contract Data / CCAP'], ['CCTP'], ['CCAG Travaux', 'CCAG']],
  FR_PRIVE: [['CCAP', 'Contract Data / CCAP'], ['CCTP']],
  COMMERCIAL: [],
};

/**
 * Points d'attention proactifs. level : 'critique' | 'attention' | 'info'.
 * action : onglet de la fiche contrat à ouvrir (+ éventuellement un modèle de courrier conseillé).
 */
export function computeInsights(db, { contractId } = {}) {
  const contracts = contractId
    ? db.prepare('SELECT * FROM contracts WHERE id = ?').all(Number(contractId))
    : db.prepare('SELECT * FROM contracts').all();
  const out = [];
  const now = today();
  const settings = getSettings(db);
  for (const c of contracts) {
    if (CLOSED_CONTRACT.includes(c.status)) continue;
    const add = (level, title, detail, tab, extra = {}) => out.push({ level, title, detail, tab, contract_id: c.id, contract_title: c.title, contract_reference: c.reference, ...extra });
    const nec = NEC.has(c.framework);
    const all = (sql) => db.prepare(sql).all(c.id);

    // Pièces de référence
    const categories = new Set(all('SELECT DISTINCT category FROM documents WHERE contract_id = ?').map((r) => r.category));
    const required = [...REQUIRED_DOCS.ALL, ...(REQUIRED_DOCS[c.framework] ?? []), ...(c.group_type ? [['Convention de groupement']] : [])];
    const missing = required.filter((alts) => !alts.some((a) => categories.has(a))).map((alts) => alts[0]);
    if (missing.length) add('attention', `Pièces de référence manquantes : ${missing.join(', ')}`, 'Archivez-les pour fiabiliser la revue de contrat et l’assistant IA.', 'documents');
    const unreadable = db.prepare("SELECT COUNT(*) AS n FROM documents WHERE contract_id = ? AND is_current = 1 AND text_status IN ('vide', 'ocr vide', 'ocr échoué')").get(c.id).n;
    if (unreadable) add('info', `${unreadable} document(s) illisible(s) même après OCR`, 'Scan de mauvaise qualité ou OCR désactivé : déposez si possible une version PDF native ou un scan plus net (300 dpi).', 'documents');
    const lowOcr = db.prepare("SELECT COUNT(*) AS n FROM documents WHERE contract_id = ? AND is_current = 1 AND text_status = 'ocr' AND ocr_confidence < 70").get(c.id).n;
    if (lowOcr) add('info', `${lowOcr} document(s) lus par OCR avec une confiance faible`, 'Vérifiez les passages importants dans le document original avant de vous fier à la recherche ou à l’IA.', 'documents');
    const reviewUpdates = db.prepare("SELECT COUNT(*) AS n FROM review_updates WHERE contract_id = ? AND status = 'proposée'").get(c.id).n;
    if (reviewUpdates) add('attention', `${reviewUpdates} mise(s) à jour de la revue à valider`, 'De nouveaux événements touchent des points de votre revue de contrat.', 'revue');

    // Revue de contrat
    const review = all('SELECT * FROM review_items WHERE contract_id = ?');
    if (!review.length) add('attention', 'Revue de contrat non réalisée', 'Lancez la revue (modèle de check-list ou analyse IA) pour identifier les clauses à risque.', 'revue');
    const hot = review.filter((r) => ['élevé', 'critique'].includes(r.risk_level) && ['à analyser', 'à négocier'].includes(r.status));
    if (hot.length) add('attention', `${hot.length} clause(s) à risque élevé non traitée(s)`, hot.slice(0, 3).map((r) => r.theme).join(', '), 'revue');

    // Organisation
    if (!all('SELECT id FROM stakeholders WHERE contract_id = ? LIMIT 1').length) add('info', 'Aucun intervenant renseigné', 'Renseignez les intervenants pour alimenter le RACI et la matrice de communication.', 'organisation');
    if (!all('SELECT id FROM raci_items WHERE contract_id = ? LIMIT 1').length) add('info', 'Matrice RACI vide', 'Définissez qui réalise, approuve, est consulté et informé pour les activités clés.', 'organisation');
    if (!all('SELECT id FROM communication_rules WHERE contract_id = ? LIMIT 1').length) add('info', 'Matrice de communication vide', 'Elle permet de proposer automatiquement les destinataires des courriers.', 'organisation');
    if (c.group_type) {
      const members = all('SELECT * FROM group_members WHERE contract_id = ?');
      const total = sum(members, (m) => m.share_percent);
      if (!members.length) add('attention', 'Groupement sans membres', 'Saisissez les cotraitants et leurs quotes-parts.', 'organisation');
      else if (Math.abs(total - 100) > 0.01) add('critique', `Quotes-parts du groupement : ${total.toFixed(2)} % au lieu de 100 %`, 'Vérifiez la répartition avec la convention de groupement.', 'organisation');
      if (members.length && !members.some((m) => m.role === 'mandataire')) add('attention', 'Aucun mandataire désigné dans le groupement', '', 'organisation');
    }

    // Early Warnings et Compensation Events
    const ews = all("SELECT * FROM early_warnings WHERE contract_id = ? AND status = 'ouvert'");
    const noReview = ews.filter((e) => !e.next_review_date || e.next_review_date < now);
    if (noReview.length) add('attention', `${noReview.length} Early Warning(s) sans revue planifiée`, noReview.slice(0, 3).map((e) => e.number).join(', '), 'ew');
    for (const ce of all('SELECT * FROM compensation_events WHERE contract_id = ?').filter(CE_OPEN)) {
      const d = ceDerived(ce, c);
      if (d.time_barred_risk) add('critique', `${ce.number} : délai de notification dépassé`, `Limite au ${d.notify_deadline}. Notifiez sans attendre et documentez la date de connaissance.`, 'ce', { open: ce.id, letter: 'ce_notification' });
      else if (d.pm_reply_due && d.pm_reply_due < now && ce.notified_by === 'Entrepreneur')
        add('attention', `${ce.number} : pas de réponse du PM depuis le ${d.pm_reply_due}`, 'Vous pouvez notifier l’absence de réponse (cl. 61.4) : sans réponse sous 2 semaines, l’événement est réputé accepté.', 'ce', { open: ce.id, letter: 'pm_failure_to_reply' });
      if (d.quotation_due && d.quotation_due < now) add('critique', `${ce.number} : devis en retard (attendu le ${d.quotation_due})`, '', 'ce', { open: ce.id, letter: 'ce_quotation' });
    }

    // Échanges
    const stale = all("SELECT * FROM correspondence WHERE contract_id = ? AND direction = 'entrant' AND status = 'à traiter'").filter((m) => m.date && addDays(m.date, 7) < now);
    if (stale.length) add('attention', `${stale.length} courrier(s) reçu(s) non traité(s) depuis plus de 7 jours`, stale.slice(0, 3).map((m) => m.subject).join(' · '), 'echanges');

    // Planning
    const imports = all('SELECT * FROM schedule_imports WHERE contract_id = ? ORDER BY id DESC LIMIT 2');
    const contractEnd = c.completion_date || c.end_date;
    if (imports[0]?.planned_completion && contractEnd && imports[0].planned_completion > contractEnd) {
      const days = Math.round((Date.parse(imports[0].planned_completion) - Date.parse(contractEnd)) / 86400000);
      add('critique', `Le dernier planning prévoit l’achèvement ${days} j après la date contractuelle`, `Fin prévue ${imports[0].planned_completion} pour ${contractEnd}. ${nec ? 'Notifiez un Early Warning et identifiez les Compensation Events éventuels.' : 'Analysez les causes et, si elles ne vous sont pas imputables, demandez une prolongation de délai.'}`, 'planning', nec ? {} : { letter: 'extension_request' });
    }
    if (imports.length === 2 && imports[0].planned_completion && imports[1].planned_completion && imports[0].planned_completion > imports[1].planned_completion) {
      const days = Math.round((Date.parse(imports[0].planned_completion) - Date.parse(imports[1].planned_completion)) / 86400000);
      add('attention', `Glissement de ${days} j entre les deux derniers plannings`, `« ${imports[1].name} » → « ${imports[0].name} »`, 'planning');
    }
    if (imports[0]) {
      const late = db.prepare('SELECT COUNT(*) AS n FROM schedule_tasks WHERE import_id = ? AND is_critical = 1 AND is_summary = 0 AND finish < ? AND COALESCE(percent_complete, 0) < 100').get(imports[0].id, imports[0].data_date || now).n;
      if (late) add('attention', `${late} tâche(s) critique(s) en retard dans le dernier planning`, 'Toute journée perdue sur le chemin critique décale l’achèvement.', 'planning');
    }

    // Programme NEC
    if (nec) {
      const programmes = all('SELECT * FROM programmes WHERE contract_id = ?');
      if (!programmes.length && !c.completion_date) {
        // rien : contrat sans données de planning
      } else if (!programmes.length) {
        add('attention', 'Aucun programme soumis', 'Sans premier programme contenant les informations requises, un quart du Price for Work Done to Date peut être retenu (NEC3 cl. 50.3 / NEC4 cl. 50.5).', 'planning');
      } else if (!programmes.some((p) => p.decision === 'accepté')) {
        add('attention', 'Aucun programme accepté à ce jour', 'Suivez les motifs de non-acceptation et resoumettez.', 'planning');
      }
    }

    // Visas
    const visas = all('SELECT * FROM submittals WHERE contract_id = ?');
    const lateVisas = visas.filter((s) => s.visa_status === 'en attente' && visaDue(s, c) && visaDue(s, c) < now);
    if (lateVisas.length) add('attention', `${lateVisas.length} visa(s) en retard`, `${lateVisas.slice(0, 3).map((s) => s.number).join(', ')} — un retard de visa peut justifier une demande de délai ou de rémunération.`, 'visas');
    const latestByNumber = new Map();
    for (const s of visas) if (!latestByNumber.has(s.number) || (s.revision ?? '') > (latestByNumber.get(s.number).revision ?? '')) latestByNumber.set(s.number, s);
    const refused = [...latestByNumber.values()].filter((s) => s.visa_status === 'refusé');
    if (refused.length) add('attention', `${refused.length} document(s) refusé(s) à resoumettre`, refused.slice(0, 3).map((s) => `${s.number} ind. ${s.revision}`).join(', '), 'visas');

    // Finances
    const f = financeSummary(db, c);
    if (f.overdue_payments) add('critique', `${f.overdue_payments} paiement(s) en retard`, 'Relancez et réclamez les intérêts moratoires si le contrat ou la réglementation le prévoit.', 'finances', { letter: 'payment_reminder' });
    if (f.variation_percent !== null && f.variation_percent > 10) add('info', `Montant actualisé : +${f.variation_percent.toFixed(1)} % par rapport au montant initial`, 'Vérifiez les seuils de modification prévus par le contrat et la réglementation applicable.', 'finances');
    if (f.ce_exposure > 0) add('info', `CE en cours chiffrés : ${Math.round(f.ce_exposure).toLocaleString('fr-FR')} ${f.currency}`, 'Montant en jeu sur les Compensation Events non encore implémentés.', 'ce');
    if (c.reception_date && FR.has(c.framework) && addDays(c.reception_date, 365) <= now && f.retention > 0) add('info', 'Garantie de parfait achèvement échue', 'Demandez la libération de la retenue de garantie (ou de la caution qui la remplace).', 'finances');

    publicInsights(db, c, { add, finance: f, latestImport: imports[0], settings });

    if (!c.completion_date && !c.end_date) add('info', 'Aucune date d’achèvement ou de fin renseignée', 'Les alertes de délai et de préavis ne peuvent pas être calculées.', 'synthese');
  }
  const order = { critique: 0, attention: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Check-lists de revue de contrat par cadre (points à vérifier dans les pièces). */
export const REVIEW_TEMPLATES = {
  COMMON: [
    ['Objet et périmètre', 'Pièces contractuelles et ordre de priorité'],
    ['Prix', 'Forme du prix (forfait, bordereau, dépenses contrôlées), révision / actualisation'],
    ['Délais', 'Délai d’exécution, jalons, dates clés'],
    ['Pénalités', 'Pénalités de retard : assiette, taux, plafond, exonérations'],
    ['Paiement', 'Avance, acomptes / situations, délai de paiement, intérêts moratoires'],
    ['Garanties', 'Retenue de garantie, caution, garantie à première demande'],
    ['Assurances', 'Responsabilité civile, tous risques chantier, décennale'],
    ['Responsabilité', 'Plafonds, exclusions, dommages indirects'],
    ['Modifications', 'Procédure des modifications / ordres de service / avenants'],
    ['Réclamations', 'Délais de notification et forclusions, procédure de différend'],
    ['Résiliation', 'Cas, préavis, indemnisation'],
    ['Sous-traitance', 'Agrément, paiement direct'],
    ['Litiges', 'Médiation, adjudication, juridiction, droit applicable'],
  ],
  NEC: [
    ['Contract Data', 'Option principale et options secondaires (X), Z-clauses'],
    ['Early Warnings', 'Fréquence des réunions de réduction des risques (cl. 15)'],
    ['Programme', 'Délai de soumission du premier programme, intervalle des programmes révisés (cl. 31-32)'],
    ['Compensation Events', 'Liste 60.1 complétée, délai de notification de 8 semaines (cl. 61.3), devis (cl. 62)'],
    ['Weather', 'Mesures et seuils météo (cl. 60.1(13))'],
    ['Delay damages', 'Option X7 : montant par jour, plafond'],
    ['Price adjustment', 'Option X1 : indices et part non ajustable'],
    ['Dispute resolution', 'Option W1 / W2 / W3, délais de référé à l’adjudicateur'],
  ],
  FR_PUBLIC: [
    ['CCAG Travaux', 'Dérogations au CCAG listées à la fin du CCAP'],
    ['Ordres de service', 'Délai de réserves sur OS'],
    ['Mémoire en réclamation', 'Délais de transmission et de réponse prévus au CCAG / CCAP'],
    ['Décompte', 'Projet de décompte final, décompte général, délais'],
    ['Réception', 'Opérations préalables, réserves, levée'],
    ['Révision des prix', 'Index BT/TP, mois zéro, clause butoir'],
    ['Sous-traitance', 'DC4, paiement direct au-delà du seuil réglementaire'],
  ],
  FR_PRIVE: [
    ['Norme NF P03-001', 'Application et dérogations'],
    ['Réception', 'Modalités, réserves, levée'],
    ['Garantie de paiement', 'Article 1799-1 du Code civil'],
  ],
};

export function reviewTemplateFor(contract) {
  if (contract.framework === 'FR_PUBLIC') return publicReviewTemplate(contract);
  const key = NEC.has(contract.framework) ? 'NEC' : contract.framework;
  return [...REVIEW_TEMPLATES.COMMON, ...(REVIEW_TEMPLATES[key] ?? [])];
}
