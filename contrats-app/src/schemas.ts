import type { Rec } from './api';

export type Option = string | { value: string; label: string };

export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox' | 'ref';
  options?: Option[];
  /** Pour type 'ref' : registre dont on propose les éléments du même contrat. */
  ref?: 'early_warnings' | 'compensation_events';
  required?: boolean;
  wide?: boolean;
  help?: string;
  placeholder?: string;
  section?: string;
  showIf?: (values: Rec) => boolean;
}

export const FRAMEWORKS: { value: string; label: string }[] = [
  { value: 'NEC4', label: 'NEC4' },
  { value: 'NEC3', label: 'NEC3' },
  { value: 'FR_PUBLIC', label: 'Marché public (FR)' },
  { value: 'FR_PRIVE', label: 'Marché privé (FR)' },
  { value: 'COMMERCIAL', label: 'Contrat commercial' },
];
export const isNec = (c?: Rec | null) => c?.framework === 'NEC3' || c?.framework === 'NEC4';
export const frameworkLabel = (v?: string) => FRAMEWORKS.find((f) => f.value === v)?.label ?? v ?? '—';

export const CONTRACT_STATUSES = ['brouillon', 'actif', 'suspendu', 'clôturé', 'résilié', 'archivé'];
export const EW_STATUSES = ['ouvert', 'clos', 'converti en CE'];
export const CE_STATUSES = ['notifié', 'devis demandé', 'devis soumis', 'implémenté', 'rejeté', 'retiré'];
export const CORR_STATUSES = ['à traiter', 'en cours', 'répondu', 'envoyé', 'classé'];
export const MILESTONE_STATUSES = ['à venir', 'en cours', 'atteint', 'en retard', 'annulé'];

export const DOCUMENT_CATEGORIES = [
  'Contrat',
  'Annexe',
  'Avenant',
  'Contract Data / CCAP',
  'Programme / Planning',
  'Échange',
  'Pièce jointe',
  'Compte rendu / PV',
  'Facture / Situation',
  'Garantie / Caution',
  'Assurance',
  'Plan / Technique',
  'Autre',
];

const nec = (v: Rec) => isNecValue(v.framework);
const isNecValue = (f?: string) => f === 'NEC3' || f === 'NEC4';

export const CONTRACT_FIELDS: Field[] = [
  { name: 'title', label: 'Intitulé du contrat', required: true, wide: true, section: 'Identification' },
  { name: 'reference', label: 'Référence / n° de marché' },
  { name: 'framework', label: 'Cadre contractuel', type: 'select', options: FRAMEWORKS, required: true },
  { name: 'nec_option', label: 'Option principale NEC', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F'], showIf: nec },
  { name: 'status', label: 'Statut', type: 'select', options: CONTRACT_STATUSES },
  { name: 'my_role', label: 'Mon rôle', type: 'select', options: ['Entrepreneur', 'Client', 'Project Manager', 'Sous-traitant', "Maître d'ouvrage", 'Titulaire', "Maître d'œuvre", 'Fournisseur', 'Prestataire', 'Autre'] },
  { name: 'counterparty', label: 'Cocontractant' },
  { name: 'project', label: 'Projet / opération' },
  { name: 'amount', label: 'Montant (HT)', type: 'number', section: 'Montant et dates' },
  { name: 'currency', label: 'Devise', type: 'select', options: ['EUR', 'DZD', 'GBP', 'USD', 'CHF', 'MAD'] },
  { name: 'signature_date', label: 'Date de signature', type: 'date' },
  { name: 'start_date', label: 'Date de démarrage (starting date)', type: 'date' },
  { name: 'completion_date', label: "Date d'achèvement (Completion Date)", type: 'date' },
  { name: 'end_date', label: 'Date de fin / échéance', type: 'date' },
  { name: 'notice_period_days', label: 'Préavis de résiliation (jours)', type: 'number', help: 'Génère une alerte « date limite de préavis » avant la fin.' },
  { name: 'tacit_renewal', label: 'Reconduction tacite', type: 'checkbox' },
  { name: 'project_manager', label: "Project Manager / Maître d'œuvre", section: 'Intervenants' },
  { name: 'supervisor', label: 'Supervisor / Contrôleur' },
  { name: 'contacts', label: 'Contacts utiles', type: 'textarea', wide: true },
  { name: 'ce_notify_weeks', label: 'Notification CE (sem.) – cl. 61.3', type: 'number', showIf: nec, section: 'Délais NEC (modifiables si le Contract Data diffère)' },
  { name: 'pm_reply_weeks', label: 'Réponse PM à notification (sem.) – cl. 61.4', type: 'number', showIf: nec },
  { name: 'quote_weeks', label: 'Remise du devis (sem.) – cl. 62.3', type: 'number', showIf: nec },
  { name: 'pm_quote_reply_weeks', label: 'Réponse PM au devis (sem.) – cl. 62.3', type: 'number', showIf: nec },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true, section: 'Notes' },
];

export const EW_FIELDS: Field[] = [
  { name: 'number', label: 'N°', placeholder: 'auto (EW-001…)' },
  { name: 'status', label: 'Statut', type: 'select', options: EW_STATUSES },
  { name: 'title', label: 'Objet', required: true, wide: true },
  { name: 'raised_by', label: 'Notifié par', type: 'select', options: ['Entrepreneur', 'Project Manager', 'Client', 'Autre'] },
  { name: 'date_notified', label: 'Date de notification', type: 'date' },
  { name: 'description', label: 'Description du risque', type: 'textarea', wide: true },
  { name: 'affects_price', label: 'Impact sur le prix', type: 'checkbox', section: 'Effets potentiels (cl. 15.1)' },
  { name: 'affects_completion', label: "Retard d'achèvement", type: 'checkbox' },
  { name: 'affects_key_date', label: 'Key Date compromise', type: 'checkbox' },
  { name: 'affects_performance', label: "Performance de l'ouvrage", type: 'checkbox' },
  { name: 'probability', label: 'Probabilité', type: 'select', options: ['Faible', 'Moyenne', 'Élevée'] },
  { name: 'impact', label: 'Gravité', type: 'select', options: ['Faible', 'Moyenne', 'Élevée', 'Critique'] },
  { name: 'owner', label: 'Responsable', section: 'Réduction du risque' },
  { name: 'next_review_date', label: 'Prochaine revue / réunion', type: 'date' },
  { name: 'actions', label: 'Actions décidées', type: 'textarea', wide: true },
  { name: 'closed_date', label: 'Date de clôture', type: 'date', showIf: (v) => v.status !== 'ouvert' },
];

export const CE_FIELDS: Field[] = [
  { name: 'number', label: 'N°', placeholder: 'auto (CE-001…)' },
  { name: 'status', label: 'Statut', type: 'select', options: CE_STATUSES },
  { name: 'title', label: 'Objet', required: true, wide: true },
  { name: 'clause', label: 'Clause (ex. 60.1(1))' },
  { name: 'early_warning_id', label: 'Early Warning lié', type: 'ref', ref: 'early_warnings' },
  { name: 'description', label: 'Description', type: 'textarea', wide: true },
  { name: 'notified_by', label: 'Notifié par', type: 'select', options: ['Entrepreneur', 'Project Manager'], section: 'Notification' },
  { name: 'date_aware', label: "Date de connaissance de l'événement", type: 'date', help: 'Point de départ du délai de 8 semaines (forclusion).' },
  { name: 'date_notified', label: 'Date de notification', type: 'date' },
  { name: 'pm_reply_date', label: 'Date de réponse du PM', type: 'date' },
  { name: 'pm_decision', label: 'Décision du PM', type: 'select', options: ['Accepté', 'Refusé', 'Silence (acceptation tacite possible)'] },
  { name: 'quotation_instructed_date', label: 'Devis demandé le', type: 'date', section: 'Devis (quotation)' },
  { name: 'quotation_submitted_date', label: 'Devis remis le', type: 'date' },
  { name: 'pm_quote_reply_date', label: 'Réponse du PM au devis le', type: 'date' },
  { name: 'quoted_amount', label: 'Montant chiffré', type: 'number' },
  { name: 'quoted_days', label: 'Délai chiffré (jours)', type: 'number' },
  { name: 'assessed_amount', label: 'Montant retenu', type: 'number', section: 'Évaluation finale' },
  { name: 'assessed_days', label: 'Délai retenu (jours)', type: 'number' },
  { name: 'implemented_date', label: "Date d'implémentation", type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const CORRESPONDENCE_FIELDS: Field[] = [
  { name: 'direction', label: 'Sens', type: 'select', options: [{ value: 'entrant', label: 'Reçu' }, { value: 'sortant', label: 'Envoyé' }], required: true },
  { name: 'type', label: 'Type', type: 'select', options: ['Courrier', 'Email', 'Notification NEC', 'Instruction', 'Ordre de service', 'Mise en demeure', 'Réserve', 'Compte rendu', 'Autre'] },
  { name: 'reference', label: 'Référence', placeholder: 'auto (ENT-001 / SOR-001)' },
  { name: 'date', label: 'Date', type: 'date' },
  { name: 'subject', label: 'Objet', required: true, wide: true },
  { name: 'sender', label: 'Expéditeur' },
  { name: 'recipient', label: 'Destinataire(s)' },
  { name: 'status', label: 'Statut', type: 'select', options: CORR_STATUSES },
  { name: 'response_required', label: 'Réponse attendue', type: 'checkbox' },
  { name: 'response_due', label: 'Répondre avant le', type: 'date', showIf: (v) => Boolean(v.response_required) },
  { name: 'response_date', label: 'Répondu le', type: 'date', showIf: (v) => Boolean(v.response_required) },
  { name: 'early_warning_id', label: 'Early Warning lié', type: 'ref', ref: 'early_warnings' },
  { name: 'compensation_event_id', label: 'Compensation Event lié', type: 'ref', ref: 'compensation_events' },
  { name: 'summary', label: 'Résumé / contenu', type: 'textarea', wide: true },
];

export const MILESTONE_FIELDS: Field[] = [
  { name: 'title', label: 'Intitulé', required: true, wide: true },
  { name: 'type', label: 'Type', type: 'select', options: ['Jalon', 'Key Date', 'Completion', 'Soumission programme', 'Réunion', 'Paiement / facturation', 'Échéance contractuelle', 'Autre'] },
  { name: 'status', label: 'Statut', type: 'select', options: MILESTONE_STATUSES },
  { name: 'planned_date', label: 'Date contractuelle / prévue', type: 'date' },
  { name: 'forecast_date', label: 'Date prévisionnelle actualisée', type: 'date' },
  { name: 'actual_date', label: 'Date réelle', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const DOCUMENT_FIELDS: Field[] = [
  { name: 'title', label: 'Titre', required: true, wide: true },
  { name: 'category', label: 'Catégorie', type: 'select', options: DOCUMENT_CATEGORIES },
  { name: 'reference', label: 'Référence' },
  { name: 'doc_date', label: 'Date du document', type: 'date' },
  { name: 'early_warning_id', label: 'Early Warning lié', type: 'ref', ref: 'early_warnings' },
  { name: 'compensation_event_id', label: 'Compensation Event lié', type: 'ref', ref: 'compensation_events' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const STATUS_COLORS: Record<string, string> = {
  actif: 'bg-emerald-100 text-emerald-800',
  brouillon: 'bg-slate-100 text-slate-700',
  suspendu: 'bg-amber-100 text-amber-800',
  clôturé: 'bg-slate-200 text-slate-700',
  résilié: 'bg-red-100 text-red-800',
  archivé: 'bg-slate-200 text-slate-600',
  ouvert: 'bg-amber-100 text-amber-800',
  clos: 'bg-slate-200 text-slate-700',
  'converti en CE': 'bg-violet-100 text-violet-800',
  notifié: 'bg-sky-100 text-sky-800',
  'devis demandé': 'bg-amber-100 text-amber-800',
  'devis soumis': 'bg-indigo-100 text-indigo-800',
  implémenté: 'bg-emerald-100 text-emerald-800',
  rejeté: 'bg-red-100 text-red-800',
  retiré: 'bg-slate-200 text-slate-600',
  'à traiter': 'bg-amber-100 text-amber-800',
  'en cours': 'bg-sky-100 text-sky-800',
  répondu: 'bg-emerald-100 text-emerald-800',
  envoyé: 'bg-indigo-100 text-indigo-800',
  classé: 'bg-slate-200 text-slate-600',
  'à venir': 'bg-sky-100 text-sky-800',
  atteint: 'bg-emerald-100 text-emerald-800',
  'en retard': 'bg-red-100 text-red-800',
  annulé: 'bg-slate-200 text-slate-600',
};

/** Onglet de la fiche contrat correspondant à chaque registre. */
export const TAB_FOR_ENTITY: Record<string, string> = {
  contracts: 'synthese',
  documents: 'documents',
  early_warnings: 'ew',
  compensation_events: 'ce',
  correspondence: 'echanges',
  milestones: 'planning',
};

export const ENTITY_LABELS: Record<string, string> = {
  contracts: 'Contrat',
  documents: 'Document',
  early_warnings: 'Early Warning',
  compensation_events: 'Compensation Event',
  correspondence: 'Échange',
  milestones: 'Jalon',
};
