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
export const CORR_STATUSES = ['à traiter', 'en cours', 'répondu', 'à envoyer', 'envoyé', 'classé'];
export const MILESTONE_STATUSES = ['à venir', 'en cours', 'atteint', 'en retard', 'annulé'];

export const DOCUMENT_CATEGORIES = [
  'Contrat',
  'Acte d’engagement',
  'Contract Data',
  'CCAP',
  'CCTP',
  'Scope / Works Information',
  'CCAG Travaux',
  'Annexe',
  'Avenant',
  'Convention de groupement',
  'BPU / DQE / DPGF',
  'Programme / Planning',
  'WBS',
  'RACI',
  'Matrice de communication',
  'Revue de contrat',
  'Visa / Document technique',
  'Échange',
  'Pièce jointe',
  'Compte rendu / PV',
  'Facture / Situation',
  'Garantie / Caution',
  'Assurance',
  'Plan / Technique',
  'CCAG',
  'Contract Data / CCAP',
  'Autre',
];

const nec = (v: Rec) => isNecValue(v.framework);
const pub = (v: Rec) => v.framework === 'FR_PUBLIC';

export const CCAG_OPTIONS = [
  { value: 'TRAVAUX_2021', label: 'CCAG Travaux 2021' },
  { value: 'FCS_2021', label: 'CCAG Fournitures courantes et services 2021' },
  { value: 'MOE_2021', label: 'CCAG Maîtrise d’œuvre 2021' },
  { value: 'PI_2021', label: 'CCAG Prestations intellectuelles 2021' },
  { value: 'TIC_2021', label: 'CCAG Techniques de l’information et de la communication 2021' },
  { value: 'MI_2021', label: 'CCAG Marchés industriels 2021' },
];
export const BUYER_TYPES = [
  { value: 'etat', label: 'État et ses établissements publics (30 j)' },
  { value: 'collectivite', label: 'Collectivité territoriale / établissement public local (30 j)' },
  { value: 'sante', label: 'Établissement public de santé (50 j)' },
  { value: 'entreprise_publique', label: 'Entreprise publique (60 j)' },
];
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
  { name: 'reception_date', label: 'Date de réception des travaux', type: 'date', help: 'Déclenche les alertes de fin de garanties (parfait achèvement, biennale).' },
  { name: 'notice_period_days', label: 'Préavis de résiliation (jours)', type: 'number', help: 'Génère une alerte « date limite de préavis » avant la fin.' },
  { name: 'tacit_renewal', label: 'Reconduction tacite', type: 'checkbox' },
  { name: 'payment_days', label: 'Délai de paiement (jours)', type: 'number', section: 'Conditions financières', help: 'Par défaut : 30 j (21 j en NEC).' },
  { name: 'retention_percent', label: 'Retenue de garantie (%)', type: 'number' },
  { name: 'advance_amount', label: 'Avance (montant)', type: 'number' },
  { name: 'price_revision', label: 'Révision / actualisation des prix', placeholder: 'ex. index BT01, mois zéro…' },
  { name: 'penalty_terms', label: 'Pénalités de retard', placeholder: 'ex. 1/1000 par jour, plafond 10 %', wide: true },
  { name: 'visa_days', label: 'Délai de visa (jours)', type: 'number', help: 'Délai laissé au MOE / PM pour viser un document (15 j par défaut).' },
  { name: 'buyer_type', label: 'Type d’acheteur', type: 'select', options: BUYER_TYPES, showIf: pub, section: 'Marché public', help: 'Détermine le délai global de paiement légal (30, 50 ou 60 jours).' },
  { name: 'ccag', label: 'CCAG applicable', type: 'select', options: CCAG_OPTIONS, showIf: pub },
  { name: 'procedure', label: 'Procédure de passation', type: 'select', options: ['Appel d’offres ouvert', 'Appel d’offres restreint', 'Procédure adaptée (MAPA)', 'Procédure avec négociation', 'Dialogue compétitif', 'Marché sans publicité ni mise en concurrence', 'Accord-cadre / marché subséquent', 'Autre'], showIf: pub },
  { name: 'notification_date', label: 'Date de notification du marché', type: 'date', showIf: pub },
  { name: 'final_account_sent_date', label: 'Projet de décompte final transmis le', type: 'date', showIf: pub, section: 'Décompte' },
  { name: 'dgd_notified_date', label: 'Décompte général notifié le', type: 'date', showIf: pub, help: '30 jours pour le retourner signé, avec ou sans réserves.' },
  { name: 'dgd_signed_date', label: 'Décompte général retourné le', type: 'date', showIf: pub },
  { name: 'dgd_reserves', label: 'Retourné avec réserves', type: 'checkbox', showIf: pub },
  { name: 'group_type', label: 'Groupement', type: 'select', options: [{ value: 'conjoint', label: 'Groupement conjoint' }, { value: 'solidaire', label: 'Groupement solidaire' }] },
  { name: 'project_manager', label: "Project Manager / Maître d'œuvre", section: 'Intervenants' },
  { name: 'supervisor', label: 'Supervisor / Contrôleur' },
  { name: 'contacts', label: 'Contacts utiles', type: 'textarea', wide: true },
  { name: 'ce_notify_weeks', label: 'Notification CE (sem.) – cl. 61.3', type: 'number', showIf: nec, section: 'Délais NEC (modifiables si le Contract Data diffère)' },
  { name: 'pm_reply_weeks', label: 'Réponse PM à notification (sem.) – cl. 61.4', type: 'number', showIf: nec },
  { name: 'quote_weeks', label: 'Remise du devis (sem.) – cl. 62.3', type: 'number', showIf: nec },
  { name: 'pm_quote_reply_weeks', label: 'Réponse PM au devis (sem.) – cl. 62.3', type: 'number', showIf: nec },
  { name: 'pm_programme_reply_weeks', label: 'Réponse PM au programme (sem.) – cl. 31.3', type: 'number', showIf: nec },
  { name: 'programme_interval_weeks', label: 'Intervalle des programmes révisés (sem.) – cl. 32.2', type: 'number', showIf: nec, help: 'Selon le Contract Data.' },
  {
    name: 'ai_provider',
    label: 'Moteur d’IA pour ce contrat',
    type: 'select',
    section: 'Assistant IA',
    options: [
      { value: 'ollama', label: 'Toujours en local (Ollama) – documents confidentiels' },
      { value: 'claude', label: 'Claude (cloud)' },
      { value: 'off', label: 'Désactivée pour ce contrat' },
    ],
    help: 'Vide : le moteur choisi dans la barre du haut s’applique.',
  },
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

export const SERVICE_ORDER_FIELDS: Field[] = [
  { name: 'number', label: 'N°', placeholder: 'auto (OS-001…)' },
  { name: 'status', label: 'Statut', type: 'select', options: ['reçu', 'accepté sans réserve', 'réserves émises', 'clos'] },
  { name: 'title', label: 'Objet', required: true, wide: true },
  { name: 'kind', label: 'Nature', type: 'select', options: ['Démarrage', 'Prescriptions techniques', 'Modification / travaux supplémentaires', 'Ajournement', 'Reprise', 'Prix nouveaux', 'Autre'] },
  { name: 'issued_date', label: 'Émis le', type: 'date' },
  { name: 'received_date', label: 'Reçu le', type: 'date', help: 'Point de départ des 15 jours pour émettre des réserves.' },
  { name: 'effect_date', label: 'Date d’effet', type: 'date' },
  { name: 'amount', label: 'Incidence financière estimée (HT)', type: 'number' },
  { name: 'extra_days', label: 'Incidence sur le délai (jours)', type: 'number' },
  { name: 'reserves_due', label: 'Réserves avant le', type: 'date', help: 'Laisser vide : réception + 15 jours.' },
  { name: 'reserves_date', label: 'Réserves émises le', type: 'date' },
  { name: 'reserves_text', label: 'Motifs des réserves', type: 'textarea', wide: true },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const CLAIM_FIELDS: Field[] = [
  { name: 'number', label: 'N°', placeholder: 'auto (REC-001…)' },
  { name: 'status', label: 'Statut', type: 'select', options: ['différend', 'mémoire transmis', 'accepté', 'partiellement accepté', 'rejeté', 'médiation / CCRA', 'contentieux', 'clos', 'abandonné'] },
  { name: 'title', label: 'Objet du différend', required: true, wide: true },
  { name: 'dispute_date', label: 'Différend apparu le', type: 'date', help: '2 mois pour transmettre le mémoire en réclamation.' },
  { name: 'memo_due', label: 'Mémoire à transmettre avant le', type: 'date', help: 'Laisser vide : calculé (+2 mois).' },
  { name: 'memo_sent_date', label: 'Mémoire transmis le', type: 'date' },
  { name: 'amount_claimed', label: 'Montant réclamé (HT)', type: 'number' },
  { name: 'extra_days_claimed', label: 'Prolongation demandée (jours)', type: 'number' },
  { name: 'response_due', label: 'Réponse attendue avant le', type: 'date', help: 'Laisser vide : envoi + 2 mois (silence = rejet).' },
  { name: 'response_date', label: 'Réponse reçue le', type: 'date' },
  { name: 'decision', label: 'Décision de l’acheteur', type: 'textarea', wide: true },
  { name: 'amount_obtained', label: 'Montant obtenu (HT)', type: 'number' },
  { name: 'next_step', label: 'Suite envisagée', type: 'select', options: ['Négociation', 'Médiation', 'Comité consultatif de règlement amiable (CCRA)', 'Tribunal administratif', 'Abandon'] },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const SUBCONTRACTOR_FIELDS: Field[] = [
  { name: 'company', label: 'Entreprise', required: true },
  { name: 'status', label: 'Statut', type: 'select', options: ['en cours d’agrément', 'agréé', 'refusé', 'terminé'] },
  { name: 'scope', label: 'Prestations sous-traitées', type: 'textarea', wide: true },
  { name: 'amount_ht', label: 'Montant sous-traité (HT)', type: 'number' },
  { name: 'direct_payment', label: 'Paiement direct', type: 'checkbox', help: 'Obligatoire dès 600 € TTC (CCP, art. R2193-10).' },
  { name: 'dc4_date', label: 'DC4 transmis le', type: 'date' },
  { name: 'approval_date', label: 'Acceptation / agrément le', type: 'date' },
  { name: 'contact', label: 'Contact' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
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

export const AMENDMENT_FIELDS: Field[] = [
  { name: 'number', label: 'N°', placeholder: 'auto (AV-001…)' },
  { name: 'status', label: 'Statut', type: 'select', options: ['en négociation', 'signé', 'refusé'] },
  { name: 'title', label: 'Objet', required: true, wide: true },
  { name: 'signature_date', label: 'Date de signature', type: 'date' },
  { name: 'amount', label: 'Incidence financière (HT)', type: 'number', help: 'Négatif pour une moins-value.' },
  { name: 'extra_days', label: 'Incidence sur le délai (jours)', type: 'number' },
  { name: 'description', label: 'Description', type: 'textarea', wide: true },
];

export const PAYMENT_FIELDS: Field[] = [
  { name: 'number', label: 'N°', placeholder: 'auto (SIT-001…)' },
  { name: 'status', label: 'Statut', type: 'select', options: ['soumise', 'validée', 'payée', 'contestée'] },
  { name: 'period', label: 'Période', placeholder: 'ex. mars 2027' },
  { name: 'submitted_date', label: 'Date de remise', type: 'date' },
  { name: 'amount_requested', label: 'Montant demandé (HT)', type: 'number' },
  { name: 'validated_date', label: 'Date de validation', type: 'date' },
  { name: 'amount_validated', label: 'Montant validé (HT)', type: 'number' },
  { name: 'due_date', label: 'Échéance de paiement', type: 'date', help: 'Laisser vide : calculée avec le délai de paiement du contrat.' },
  { name: 'paid_date', label: 'Payée le', type: 'date' },
  { name: 'amount_paid', label: 'Montant payé', type: 'number' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const PROGRAMME_FIELDS: Field[] = [
  { name: 'number', label: 'N°', placeholder: 'auto (PRG-001…)' },
  { name: 'status', label: 'Statut', type: 'select', options: ['soumis', 'accepté', 'non accepté', 'remplacé'] },
  { name: 'title', label: 'Intitulé', required: true, wide: true, placeholder: 'ex. Programme révisé n°3' },
  { name: 'submitted_date', label: 'Soumis le', type: 'date' },
  { name: 'planned_completion', label: 'Planned Completion', type: 'date' },
  { name: 'pm_response_date', label: 'Réponse du PM le', type: 'date' },
  { name: 'decision', label: 'Décision', type: 'select', options: ['accepté', 'non accepté'] },
  { name: 'reasons', label: 'Motifs de non-acceptation (cl. 31.3)', type: 'textarea', wide: true },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const VISA_STATUSES = ['en attente', 'VSO', 'VAO', 'refusé', 'sans objet'];
export const SUBMITTAL_FIELDS: Field[] = [
  { name: 'number', label: 'N° document', placeholder: 'auto (VIS-001…)' },
  { name: 'revision', label: 'Indice' },
  { name: 'title', label: 'Intitulé', required: true, wide: true },
  { name: 'discipline', label: 'Lot / discipline' },
  { name: 'emitter', label: 'Émetteur' },
  { name: 'reviewer', label: 'Viseur (MOE / PM / BCT)' },
  { name: 'submitted_date', label: 'Transmis le', type: 'date' },
  { name: 'visa_due', label: 'Visa attendu le', type: 'date', help: 'Laisser vide : calculé avec le délai de visa du contrat.' },
  { name: 'visa_date', label: 'Visé le', type: 'date' },
  { name: 'visa_status', label: 'Avis', type: 'select', options: VISA_STATUSES },
  { name: 'comments', label: 'Observations', type: 'textarea', wide: true },
];

export const STAKEHOLDER_FIELDS: Field[] = [
  { name: 'name', label: 'Nom', required: true },
  { name: 'organisation', label: 'Organisme' },
  { name: 'role', label: 'Rôle', placeholder: 'ex. Project Manager, MOE, OPC, BCT…' },
  { name: 'email', label: 'Email' },
  { name: 'phone', label: 'Téléphone' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const GROUP_MEMBER_FIELDS: Field[] = [
  { name: 'company', label: 'Entreprise', required: true },
  { name: 'role', label: 'Rôle', type: 'select', options: ['mandataire', 'cotraitant'] },
  { name: 'share_percent', label: 'Quote-part (%)', type: 'number' },
  { name: 'amount', label: 'Montant de sa part (HT)', type: 'number' },
  { name: 'scope', label: 'Prestations à sa charge', type: 'textarea', wide: true },
  { name: 'contact', label: 'Contact' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const WBS_FIELDS: Field[] = [
  { name: 'code', label: 'Code WBS', required: true, placeholder: 'ex. 1.2.3' },
  { name: 'parent_code', label: 'Code parent' },
  { name: 'title', label: 'Intitulé', required: true, wide: true },
  { name: 'budget', label: 'Budget (HT)', type: 'number' },
  { name: 'owner', label: 'Responsable' },
  { name: 'description', label: 'Description', type: 'textarea', wide: true },
];

export const COMMUNICATION_FIELDS: Field[] = [
  { name: 'subject', label: 'Information / document', required: true, wide: true, placeholder: 'ex. Notifications de Compensation Events' },
  { name: 'info_type', label: 'Type (pour les courriers)', type: 'select', options: ['Early Warning', 'Compensation Event', 'Courrier', 'Visa', 'Paiement', 'Délai', 'Mise en demeure', 'Compte rendu', 'Autre'], help: 'Sert à proposer le destinataire lors de la génération d’un courrier.' },
  { name: 'sender', label: 'Émetteur' },
  { name: 'recipients', label: 'Destinataires' },
  { name: 'cc', label: 'Copie' },
  { name: 'channel', label: 'Canal', type: 'select', options: ['Email', 'LRAR', 'Plateforme', 'Courrier remis en main propre', 'Réunion', 'Autre'] },
  { name: 'frequency', label: 'Fréquence', placeholder: 'ex. hebdomadaire, à l’événement' },
  { name: 'delay_days', label: 'Délai (jours)', type: 'number' },
  { name: 'clause', label: 'Clause' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const RISK_LEVELS = ['faible', 'moyen', 'élevé', 'critique'];
export const REVIEW_FIELDS: Field[] = [
  { name: 'theme', label: 'Thème', required: true },
  { name: 'clause_ref', label: 'Clause / article' },
  { name: 'content', label: 'Contenu / constat', type: 'textarea', wide: true },
  { name: 'risk_level', label: 'Niveau de risque', type: 'select', options: RISK_LEVELS },
  { name: 'status', label: 'Statut', type: 'select', options: ['à analyser', 'analysé', 'à négocier', 'accepté'] },
  { name: 'mitigation', label: 'Mesure de maîtrise', type: 'textarea', wide: true },
  { name: 'owner', label: 'Responsable' },
  { name: 'history', label: 'Historique (veille, imports)', type: 'textarea', wide: true },
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
  'devis soumis': 'bg-brand-100 text-brand-800',
  implémenté: 'bg-emerald-100 text-emerald-800',
  rejeté: 'bg-red-100 text-red-800',
  retiré: 'bg-slate-200 text-slate-600',
  'à traiter': 'bg-amber-100 text-amber-800',
  'en cours': 'bg-sky-100 text-sky-800',
  répondu: 'bg-emerald-100 text-emerald-800',
  envoyé: 'bg-brand-100 text-brand-800',
  classé: 'bg-slate-200 text-slate-600',
  'à venir': 'bg-sky-100 text-sky-800',
  atteint: 'bg-emerald-100 text-emerald-800',
  'en retard': 'bg-red-100 text-red-800',
  annulé: 'bg-slate-200 text-slate-600',
  'à envoyer': 'bg-violet-100 text-violet-800',
  'en négociation': 'bg-amber-100 text-amber-800',
  signé: 'bg-emerald-100 text-emerald-800',
  refusé: 'bg-red-100 text-red-800',
  soumise: 'bg-sky-100 text-sky-800',
  validée: 'bg-brand-100 text-brand-800',
  payée: 'bg-emerald-100 text-emerald-800',
  contestée: 'bg-red-100 text-red-800',
  soumis: 'bg-sky-100 text-sky-800',
  accepté: 'bg-emerald-100 text-emerald-800',
  'non accepté': 'bg-red-100 text-red-800',
  remplacé: 'bg-slate-200 text-slate-600',
  'en attente': 'bg-amber-100 text-amber-800',
  VSO: 'bg-emerald-100 text-emerald-800',
  VAO: 'bg-lime-100 text-lime-800',
  'sans objet': 'bg-slate-200 text-slate-600',
  'à analyser': 'bg-amber-100 text-amber-800',
  analysé: 'bg-sky-100 text-sky-800',
  'à négocier': 'bg-red-100 text-red-800',
  faible: 'bg-slate-100 text-slate-700',
  moyen: 'bg-amber-100 text-amber-800',
  élevé: 'bg-orange-100 text-orange-800',
  critique: 'bg-red-100 text-red-800',
  attention: 'bg-amber-100 text-amber-800',
  info: 'bg-sky-100 text-sky-800',
  mandataire: 'bg-brand-100 text-brand-800',
  cotraitant: 'bg-slate-100 text-slate-700',
  règle: 'bg-slate-100 text-slate-700',
  reçu: 'bg-amber-100 text-amber-800',
  'accepté sans réserve': 'bg-slate-200 text-slate-700',
  'réserves émises': 'bg-emerald-100 text-emerald-800',
  différend: 'bg-amber-100 text-amber-800',
  'mémoire transmis': 'bg-sky-100 text-sky-800',
  'partiellement accepté': 'bg-lime-100 text-lime-800',
  'médiation / CCRA': 'bg-violet-100 text-violet-800',
  contentieux: 'bg-red-100 text-red-800',
  abandonné: 'bg-slate-200 text-slate-600',
  'en cours d’agrément': 'bg-amber-100 text-amber-800',
  agréé: 'bg-emerald-100 text-emerald-800',
  terminé: 'bg-slate-200 text-slate-600',
  IA: 'bg-violet-100 text-violet-800',
};

/** Onglet de la fiche contrat correspondant à chaque registre. */
export const TAB_FOR_ENTITY: Record<string, string> = {
  contracts: 'synthese',
  documents: 'documents',
  early_warnings: 'ew',
  compensation_events: 'ce',
  correspondence: 'echanges',
  milestones: 'planning',
  programmes: 'planning',
  schedule_imports: 'planning',
  wbs_items: 'planning',
  submittals: 'visas',
  amendments: 'finances',
  payments: 'finances',
  stakeholders: 'organisation',
  group_members: 'organisation',
  raci_items: 'organisation',
  communication_rules: 'organisation',
  review_items: 'revue',
  service_orders: 'marche',
  claims: 'marche',
  subcontractors: 'marche',
};

export const ENTITY_LABELS: Record<string, string> = {
  contracts: 'Contrat',
  documents: 'Document',
  early_warnings: 'Early Warning',
  compensation_events: 'Compensation Event',
  correspondence: 'Échange',
  milestones: 'Jalon',
  programmes: 'Programme',
  schedule_imports: 'Planning importé',
  wbs_items: 'Élément WBS',
  submittals: 'Visa',
  amendments: 'Avenant',
  payments: 'Situation',
  stakeholders: 'Intervenant',
  group_members: 'Membre du groupement',
  raci_items: 'Activité RACI',
  communication_rules: 'Règle de communication',
  review_items: 'Point de revue',
  review_updates: 'Veille de revue',
  service_orders: 'Ordre de service',
  claims: 'Réclamation',
  subcontractors: 'Sous-traitant',
};
