// Modèles de courriers contractuels générés au format Word (.docx).
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { addDays } from './deadlines.js';

const fr = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '[date]');
const money = (n, cur = 'EUR') =>
  n === null || n === undefined ? '[montant]' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur || 'EUR' }).format(n);
const ref = (c) => `${c.reference ? `n° ${c.reference} ` : ''}« ${c.title} »`;
const effects = (ew) =>
  [ew.affects_price && 'le montant du contrat', ew.affects_completion && "la date d'achèvement", ew.affects_key_date && 'une Key Date', ew.affects_performance && "la performance de l'ouvrage"]
    .filter(Boolean)
    .join(', ') || '[effets à préciser]';

/**
 * Chaque modèle : entity = registre source (ou 'contracts'), frameworks = cadres concernés (vide = tous),
 * build(ctx) → { subject, body } où body est un texte avec paragraphes séparés par une ligne vide.
 */
export const TEMPLATES = {
  ew_notification: {
    label: 'Notification d’Early Warning (cl. 15.1)',
    entity: 'early_warnings',
    frameworks: ['NEC3', 'NEC4'],
    infoType: 'Early Warning',
    build: ({ contract: c, entity: ew }) => ({
      subject: `Notification d'Early Warning ${ew.number} – ${ew.title}`,
      body: [
        `Conformément à la clause 15.1 du contrat ${ref(c)}, nous vous notifions par la présente un Early Warning relatif à : ${ew.title}.`,
        ew.description || '[Description de la situation et de ses causes]',
        `Cette situation est susceptible d'affecter ${effects(ew)}.`,
        `Nous vous proposons d'inscrire ce point au registre des Early Warnings et de l'examiner lors d'une réunion de réduction des risques${ew.next_review_date ? `, que nous suggérons de tenir le ${fr(ew.next_review_date)}` : ''}.`,
        ew.actions ? `Actions envisagées pour réduire le risque :\n${ew.actions}` : '',
      ],
    }),
  },
  ce_notification: {
    label: 'Notification de Compensation Event (cl. 61.3)',
    entity: 'compensation_events',
    frameworks: ['NEC3', 'NEC4'],
    infoType: 'Compensation Event',
    build: ({ contract: c, entity: ce }) => ({
      subject: `Notification de Compensation Event ${ce.number} – ${ce.title}`,
      body: [
        `Conformément à la clause 61.3 du contrat ${ref(c)}, nous vous notifions l'événement suivant, dont nous avons eu connaissance le ${fr(ce.date_aware)} : ${ce.title}.`,
        ce.description || '[Description de l’événement]',
        `Nous considérons que cet événement constitue un Compensation Event au titre de la clause ${ce.clause || '60.1([…])'}, et qu'il est susceptible d'avoir une incidence sur les Prices et/ou la Completion Date.`,
        'Nous vous remercions de bien vouloir nous faire part de votre réponse dans le délai contractuel et, le cas échéant, de nous demander la remise d’un devis (quotation).',
      ],
    }),
  },
  ce_quotation: {
    label: 'Transmission d’un devis de CE (cl. 62)',
    entity: 'compensation_events',
    frameworks: ['NEC3', 'NEC4'],
    infoType: 'Compensation Event',
    build: ({ contract: c, entity: ce }) => ({
      subject: `Devis (quotation) – Compensation Event ${ce.number} – ${ce.title}`,
      body: [
        `En réponse à votre demande du ${fr(ce.quotation_instructed_date)}, et conformément à la clause 62 du contrat ${ref(c)}, nous vous transmettons notre devis relatif au Compensation Event ${ce.number}.`,
        `Incidence sur les Prices : ${money(ce.quoted_amount, c.currency)}.\nIncidence sur la Completion Date : ${ce.quoted_days ?? '[nombre]'} jour(s).`,
        'Le détail de l’évaluation (Defined Cost, fee, risques chiffrés) et le programme modifié sont joints au présent courrier.',
        'Nous restons à votre disposition pour tout complément d’information.',
      ],
    }),
  },
  pm_failure_to_reply: {
    label: 'Notification d’absence de réponse du PM (cl. 61.4)',
    entity: 'compensation_events',
    frameworks: ['NEC3', 'NEC4'],
    infoType: 'Compensation Event',
    build: ({ contract: c, entity: ce }) => ({
      subject: `Absence de réponse – Compensation Event ${ce.number} – ${ce.title}`,
      body: [
        `Par courrier du ${fr(ce.date_notified)}, nous vous avons notifié le Compensation Event ${ce.number} au titre du contrat ${ref(c)}.`,
        `À ce jour, nous n'avons pas reçu de réponse dans le délai prévu au contrat. Conformément à la clause 61.4, nous vous notifions par la présente cette absence de réponse.`,
        'Nous vous rappelons qu’à défaut de réponse dans un délai de deux semaines à compter de la présente notification, l’événement sera réputé accepté comme Compensation Event.',
      ],
    }),
  },
  reply: {
    label: 'Réponse à un courrier reçu',
    entity: 'correspondence',
    frameworks: [],
    infoType: 'Courrier',
    build: ({ contract: c, entity: m }) => ({
      subject: `Réponse à votre courrier${m.reference ? ` ${m.reference}` : ''} du ${fr(m.date)} – ${m.subject}`,
      body: [
        `Nous accusons réception de votre courrier${m.reference ? ` référencé ${m.reference}` : ''} du ${fr(m.date)} relatif à « ${m.subject} », dans le cadre du contrat ${ref(c)}.`,
        '[Votre réponse]',
        'Nous restons à votre disposition pour en échanger.',
      ],
    }),
  },
  visa_transmission: {
    label: 'Transmission d’un document pour visa',
    entity: 'submittals',
    frameworks: [],
    infoType: 'Visa',
    build: ({ contract: c, entity: s }) => ({
      subject: `Transmission pour visa – ${s.number} indice ${s.revision ?? 'A'} – ${s.title}`,
      body: [
        `Dans le cadre du contrat ${ref(c)}, nous vous transmettons pour visa le document ${s.number} indice ${s.revision ?? 'A'} : ${s.title}${s.discipline ? ` (${s.discipline})` : ''}.`,
        `Nous vous remercions de nous faire part de votre visa dans le délai contractuel, soit au plus tard le ${fr(s.visa_due || addDays(s.submitted_date, c.visa_days ?? 15))}.`,
      ],
    }),
  },
  payment_reminder: {
    label: 'Relance de paiement',
    entity: 'payments',
    frameworks: [],
    infoType: 'Paiement',
    build: ({ contract: c, entity: p }) => ({
      subject: `Relance – demande de paiement ${p.number ?? ''} du ${fr(p.submitted_date)}`,
      body: [
        `Par demande de paiement ${p.number ?? ''} du ${fr(p.submitted_date)}${p.period ? ` (période : ${p.period})` : ''}, nous avons sollicité le règlement de ${money(p.amount_validated ?? p.amount_requested, c.currency)} au titre du contrat ${ref(c)}.`,
        `L'échéance de paiement fixée au ${fr(p.due_date || p.computed_due_date)} est dépassée et ce montant ne nous a pas été réglé à ce jour.`,
        'Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais. Nous nous réservons le droit de réclamer les intérêts moratoires et indemnités prévus par le contrat et la réglementation applicable.',
      ],
    }),
  },
  extension_request: {
    label: 'Demande de prolongation de délai',
    entity: 'contracts',
    frameworks: ['FR_PUBLIC', 'FR_PRIVE', 'COMMERCIAL'],
    infoType: 'Délai',
    build: ({ contract: c }) => ({
      subject: `Demande de prolongation du délai d'exécution – ${c.title}`,
      body: [
        `Dans le cadre du contrat ${ref(c)}, nous sollicitons une prolongation du délai d'exécution pour les motifs suivants :`,
        '[Exposé des causes : événements, dates, pièces justificatives]',
        '[Durée de prolongation demandée et nouvelle date d’achèvement proposée]',
        'Nous vous remercions de bien vouloir nous faire part de votre décision.',
      ],
    }),
  },
  formal_notice: {
    label: 'Mise en demeure',
    entity: 'contracts',
    frameworks: [],
    infoType: 'Mise en demeure',
    build: ({ contract: c }) => ({
      subject: `Mise en demeure – contrat ${c.reference ?? c.title}`,
      body: [
        `Malgré nos précédents échanges, nous constatons que [manquement constaté], en méconnaissance des stipulations du contrat ${ref(c)} [article / clause].`,
        'Par la présente, nous vous mettons en demeure de [obligation à exécuter] dans un délai de [nombre] jours à compter de la réception du présent courrier.',
        'À défaut, nous nous réservons la possibilité de faire valoir l’ensemble de nos droits.',
      ],
    }),
  },
};

export function listTemplates(contract) {
  return Object.entries(TEMPLATES)
    .filter(([, t]) => !t.frameworks.length || t.frameworks.includes(contract?.framework))
    .map(([id, t]) => ({ id, label: t.label, entity: t.entity }));
}

/** Destinataire proposé : la matrice de communication d'abord, sinon le PM / maître d'œuvre. */
export function suggestRecipient(db, contract, template) {
  const rules = db.prepare('SELECT * FROM communication_rules WHERE contract_id = ?').all(contract.id);
  const rule = rules.find((r) => r.info_type && r.info_type === template.infoType) ?? rules.find((r) => r.subject?.toLowerCase().includes(template.infoType.toLowerCase()));
  return { recipient: rule?.recipients || contract.project_manager || contract.counterparty || '', cc: rule?.cc || '', channel: rule?.channel || '' };
}

export function buildLetter(db, { templateId, contract, entity, settings }) {
  const template = TEMPLATES[templateId];
  if (!template) throw Object.assign(new Error('Modèle de courrier inconnu'), { status: 400 });
  const { subject, body } = template.build({ contract, entity: entity ?? {}, settings });
  return { subject, body: body.filter(Boolean).join('\n\n'), ...suggestRecipient(db, contract, template) };
}

export async function renderDocx({ subject, body, recipient, cc, contract, settings, date }) {
  const p = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts.run })], spacing: { after: opts.after ?? 0 }, alignment: opts.align });
  const lines = (text) => String(text ?? '').split('\n');
  const children = [
    ...lines(settings.company_name || '[Votre société]').map((l) => p(l, { run: { bold: true } })),
    ...lines(settings.company_address || '').map((l) => p(l)),
    p('', { after: 200 }),
    ...lines(recipient || '[Destinataire]').map((l) => p(l, { align: AlignmentType.RIGHT })),
    p('', { after: 200 }),
    p(`${settings.city ? `${settings.city}, le ` : 'Le '}${fr(date)}`, { align: AlignmentType.RIGHT, after: 300 }),
    p(`Objet : ${subject}`, { run: { bold: true } }),
    p(`Contrat : ${contract.reference ? `${contract.reference} – ` : ''}${contract.title}`),
    ...(cc ? [p(`Copie : ${cc}`)] : []),
    p('', { after: 300 }),
    p('Madame, Monsieur,', { after: 200 }),
    ...String(body)
      .split(/\n{2,}/)
      .map((para) => new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.JUSTIFIED, children: lines(para).flatMap((l, i) => [new TextRun({ text: l, break: i ? 1 : 0 })]) })),
    p('Nous vous prions d’agréer, Madame, Monsieur, l’expression de nos salutations distinguées.', { after: 500 }),
    p(settings.signatory_name || '[Signataire]', { align: AlignmentType.RIGHT, run: { bold: true } }),
    p(settings.signatory_title || '', { align: AlignmentType.RIGHT }),
  ];
  const doc = new Document({
    creator: settings.company_name || 'Gestion contractuelle',
    title: subject,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
