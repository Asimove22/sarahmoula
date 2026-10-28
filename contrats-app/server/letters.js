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
        c.framework === 'FR_PUBLIC'
          ? `Conformément aux articles R2192-31 et D2192-35 du Code de la commande publique, ce retard ouvre droit de plein droit à des intérêts moratoires${p.late_interest?.interest != null ? `, soit ${money(p.late_interest.interest, c.currency)} à ce jour (${p.late_interest.days} jours au taux de ${p.late_interest.rate.toFixed(2)} %)` : ''}, ainsi qu'à l'indemnité forfaitaire pour frais de recouvrement de 40 €.`
          : '',
        c.framework === 'FR_PUBLIC'
          ? 'Nous vous remercions de bien vouloir procéder sans délai au règlement du principal et des intérêts moratoires.'
          : 'Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais. Nous nous réservons le droit de réclamer les intérêts moratoires et indemnités prévus par le contrat et la réglementation applicable.',
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
  os_reserves: {
    label: 'Réserves sur un ordre de service',
    entity: 'service_orders',
    frameworks: ['FR_PUBLIC'],
    infoType: 'Ordre de service',
    build: ({ contract: c, entity: os }) => ({
      subject: `Réserves sur l'ordre de service ${os.number ?? ''} du ${fr(os.issued_date)} – ${os.title}`,
      body: [
        `Nous avons reçu le ${fr(os.received_date || os.issued_date)} l'ordre de service ${os.number ?? ''} relatif à « ${os.title} », émis dans le cadre du marché ${ref(c)}.`,
        `Conformément aux stipulations du CCAG applicable relatives aux ordres de service, nous émettons par la présente les réserves suivantes, dans le délai de quinze jours qui nous est imparti :`,
        os.reserves_text || '[Motifs des réserves : prescriptions excédant les obligations du marché, incidence sur les délais, incidence financière…]',
        `Ces prescriptions sont de nature à modifier ${os.extra_days ? `le délai d'exécution (estimation : ${os.extra_days} jours)` : "le délai d'exécution"}${os.amount ? ` et le prix du marché (estimation : ${money(os.amount, c.currency)})` : ' et le prix du marché'}. Nous nous réservons le droit d'en demander la juste rémunération et la prolongation du délai correspondante.`,
        'Nous exécuterons néanmoins l’ordre de service, sous ces réserves.',
      ],
    }),
  },
  memoire_reclamation: {
    label: 'Mémoire en réclamation',
    entity: 'claims',
    frameworks: ['FR_PUBLIC'],
    infoType: 'Réclamation',
    build: ({ contract: c, entity: cl }) => ({
      subject: `Mémoire en réclamation ${cl.number ?? ''} – ${cl.title}`,
      body: [
        `Dans le cadre du marché ${ref(c)}, un différend est apparu le ${fr(cl.dispute_date)} au sujet de : ${cl.title}.`,
        'Conformément aux stipulations du CCAG applicable relatives au règlement des différends, nous vous adressons le présent mémoire en réclamation.',
        '1. Exposé des faits\n[Chronologie, ordres de service, échanges, pièces justificatives]',
        '2. Motifs de la réclamation\n[Fondements contractuels : articles du CCAP, du CCAG, des pièces du marché]',
        `3. Montant et délais réclamés\nMontant demandé : ${money(cl.amount_claimed, c.currency)}${cl.extra_days_claimed ? `\nProlongation du délai d'exécution demandée : ${cl.extra_days_claimed} jours` : ''}\n[Détail du calcul en annexe]`,
        'Nous vous remercions de nous faire connaître votre décision dans le délai prévu par le CCAG, étant rappelé qu’à défaut de réponse dans ce délai, la réclamation est réputée rejetée.',
      ],
    }),
  },
  dgd_reserves: {
    label: 'Réserves sur le décompte général',
    entity: 'contracts',
    frameworks: ['FR_PUBLIC'],
    infoType: 'Décompte',
    build: ({ contract: c }) => ({
      subject: `Décompte général – marché ${c.reference ?? c.title} – réserves`,
      body: [
        `Nous avons reçu le ${fr(c.dgd_notified_date)} le décompte général du marché ${ref(c)}.`,
        'Nous vous le retournons signé, assorti des réserves suivantes, exposées dans le mémoire en réclamation joint :',
        '[Postes contestés, montants, motifs]',
        'Ces réserves portent sur les seuls points mentionnés ; le décompte est accepté pour le surplus.',
      ],
    }),
  },
};

// ---------- Versions anglaises (contrats NEC, rédigés en anglais) ----------
const enDate = (iso) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '[date]');
const enMoney = (n, cur = 'EUR') => (n === null || n === undefined ? '[amount]' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur || 'EUR' }).format(n));
const enRef = (c) => `${c.reference ? `${c.reference} ` : ''}"${c.title}"`;
const enEffects = (ew) =>
  [ew.affects_price && 'increase the total of the Prices', ew.affects_completion && 'delay Completion', ew.affects_key_date && 'delay meeting a Key Date', ew.affects_performance && 'impair the performance of the works in use']
    .filter(Boolean)
    .join(', ') || '[effects to be specified]';

const EN_TEMPLATES = {
  ew_notification: {
    label: 'Early warning notification (cl. 15.1)',
    build: ({ contract: c, entity: ew }) => ({
      subject: `Early warning ${ew.number} – ${ew.title}`,
      body: [
        `In accordance with clause 15.1 of the contract ${enRef(c)}, we hereby give an early warning of the following matter: ${ew.title}.`,
        ew.description || '[Description of the matter and its causes]',
        `This matter could ${enEffects(ew)}.`,
        `We propose that this matter is entered in the Early Warning Register and discussed at an early warning meeting${ew.next_review_date ? `, which we suggest holding on ${enDate(ew.next_review_date)}` : ''}.`,
        ew.actions ? `Proposed actions to avoid or reduce the effect of the matter:\n${ew.actions}` : '',
      ],
    }),
  },
  ce_notification: {
    label: 'Compensation event notification (cl. 61.3)',
    build: ({ contract: c, entity: ce }) => ({
      subject: `Notification of compensation event ${ce.number} – ${ce.title}`,
      body: [
        `In accordance with clause 61.3 of the contract ${enRef(c)}, we notify you of the following event, of which we became aware on ${enDate(ce.date_aware)}: ${ce.title}.`,
        ce.description || '[Description of the event]',
        `We consider that this event is a compensation event under clause ${ce.clause || '60.1([…])'} and that it may affect the Prices and/or the Completion Date.`,
        'Please reply within the period stated in the contract and, where appropriate, instruct us to submit a quotation.',
      ],
    }),
  },
  ce_quotation: {
    label: 'Quotation for a compensation event (cl. 62)',
    build: ({ contract: c, entity: ce }) => ({
      subject: `Quotation – compensation event ${ce.number} – ${ce.title}`,
      body: [
        `Further to your instruction of ${enDate(ce.quotation_instructed_date)}, and in accordance with clause 62 of the contract ${enRef(c)}, we submit our quotation for compensation event ${ce.number}.`,
        `Change to the Prices: ${enMoney(ce.quoted_amount, c.currency)}.\nDelay to the Completion Date: ${ce.quoted_days ?? '[number]'} day(s).`,
        'The detailed assessment (Defined Cost, Fee, risk allowances) and the alterations to the Accepted Programme are attached.',
        'We remain at your disposal for any further information.',
      ],
    }),
  },
  pm_failure_to_reply: {
    label: 'Notification of the Project Manager’s failure to reply (cl. 61.4)',
    build: ({ contract: c, entity: ce }) => ({
      subject: `Failure to reply – compensation event ${ce.number} – ${ce.title}`,
      body: [
        `On ${enDate(ce.date_notified)} we notified compensation event ${ce.number} under the contract ${enRef(c)}.`,
        'To date we have not received your reply within the time allowed. In accordance with clause 61.4, we hereby notify you of this failure.',
        'If the failure continues for a further two weeks after this notification, it is treated as acceptance that the event is a compensation event and an instruction to submit a quotation.',
      ],
    }),
  },
  reply: {
    label: 'Reply to a received letter',
    build: ({ contract: c, entity: m }) => ({
      subject: `Reply to your letter${m.reference ? ` ${m.reference}` : ''} of ${enDate(m.date)} – ${m.subject}`,
      body: [`We acknowledge receipt of your letter${m.reference ? ` ref. ${m.reference}` : ''} dated ${enDate(m.date)} concerning "${m.subject}", under the contract ${enRef(c)}.`, '[Your reply]', 'We remain available to discuss this matter.'],
    }),
  },
  visa_transmission: {
    label: 'Submission of a document for acceptance',
    build: ({ contract: c, entity: s }) => ({
      subject: `Submission for acceptance – ${s.number} rev. ${s.revision ?? 'A'} – ${s.title}`,
      body: [
        `Under the contract ${enRef(c)}, we submit for your acceptance document ${s.number} revision ${s.revision ?? 'A'}: ${s.title}${s.discipline ? ` (${s.discipline})` : ''}.`,
        `Please reply within the period for reply, i.e. no later than ${enDate(s.visa_due || s.computed_visa_due)}.`,
      ],
    }),
  },
  payment_reminder: {
    label: 'Payment reminder',
    build: ({ contract: c, entity: p }) => ({
      subject: `Reminder – payment application ${p.number ?? ''} of ${enDate(p.submitted_date)}`,
      body: [
        `By payment application ${p.number ?? ''} dated ${enDate(p.submitted_date)}${p.period ? ` (period: ${p.period})` : ''}, we applied for payment of ${enMoney(p.amount_validated ?? p.amount_requested, c.currency)} under the contract ${enRef(c)}.`,
        `Payment was due on ${enDate(p.due_date || p.computed_due_date)} and has not been received to date.`,
        'Please arrange payment without further delay. We reserve our right to interest on late payment as provided by the contract.',
      ],
    }),
  },
};

/** Langue par défaut d'un courrier : anglais pour un contrat NEC (si le modèle existe), français sinon. */
export const defaultLetterLang = (contract, templateId) => (['NEC3', 'NEC4'].includes(contract?.framework) && EN_TEMPLATES[templateId] ? 'en' : 'fr');

export function listTemplates(contract) {
  return Object.entries(TEMPLATES)
    .filter(([, t]) => !t.frameworks.length || t.frameworks.includes(contract?.framework))
    .map(([id, t]) => ({ id, label: t.label, label_en: EN_TEMPLATES[id]?.label ?? null, entity: t.entity, languages: EN_TEMPLATES[id] ? ['fr', 'en'] : ['fr'] }));
}

/** Destinataire proposé : la matrice de communication d'abord, sinon le PM / maître d'œuvre. */
export function suggestRecipient(db, contract, template) {
  const rules = db.prepare('SELECT * FROM communication_rules WHERE contract_id = ?').all(contract.id);
  const rule = rules.find((r) => r.info_type && r.info_type === template.infoType) ?? rules.find((r) => r.subject?.toLowerCase().includes(template.infoType.toLowerCase()));
  return { recipient: rule?.recipients || contract.project_manager || contract.counterparty || '', cc: rule?.cc || '', channel: rule?.channel || '' };
}

export function buildLetter(db, { templateId, contract, entity, settings, lang }) {
  const template = TEMPLATES[templateId];
  if (!template) throw Object.assign(new Error('Modèle de courrier inconnu'), { status: 400 });
  const language = lang === 'en' && EN_TEMPLATES[templateId] ? 'en' : lang === 'fr' ? 'fr' : defaultLetterLang(contract, templateId);
  const builder = language === 'en' ? EN_TEMPLATES[templateId].build : template.build;
  const { subject, body } = builder({ contract, entity: entity ?? {}, settings });
  return { subject, body: body.filter(Boolean).join('\n\n'), lang: language, languages: EN_TEMPLATES[templateId] ? ['fr', 'en'] : ['fr'], ...suggestRecipient(db, contract, template) };
}

export async function renderDocx({ subject, body, recipient, cc, contract, settings, date, lang = 'fr' }) {
  const en = lang === 'en';
  const p = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts.run })], spacing: { after: opts.after ?? 0 }, alignment: opts.align });
  const lines = (text) => String(text ?? '').split('\n');
  const children = [
    ...lines(settings.company_name || (en ? '[Your company]' : '[Votre société]')).map((l) => p(l, { run: { bold: true } })),
    ...lines(settings.company_address || '').map((l) => p(l)),
    p('', { after: 200 }),
    ...lines(recipient || (en ? '[Addressee]' : '[Destinataire]')).map((l) => p(l, { align: AlignmentType.RIGHT })),
    p('', { after: 200 }),
    p(en ? `${settings.city ? `${settings.city}, ` : ''}${enDate(date)}` : `${settings.city ? `${settings.city}, le ` : 'Le '}${fr(date)}`, { align: AlignmentType.RIGHT, after: 300 }),
    p(`${en ? 'Subject:' : 'Objet :'} ${subject}`, { run: { bold: true } }),
    p(`${en ? 'Contract:' : 'Contrat :'} ${contract.reference ? `${contract.reference} – ` : ''}${contract.title}`),
    ...(cc ? [p(`${en ? 'Copy:' : 'Copie :'} ${cc}`)] : []),
    p('', { after: 300 }),
    p(en ? 'Dear Sir or Madam,' : 'Madame, Monsieur,', { after: 200 }),
    ...String(body)
      .split(/\n{2,}/)
      .map((para) => new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.JUSTIFIED, children: lines(para).flatMap((l, i) => [new TextRun({ text: l, break: i ? 1 : 0 })]) })),
    p(en ? 'Yours faithfully,' : 'Nous vous prions d’agréer, Madame, Monsieur, l’expression de nos salutations distinguées.', { after: 500 }),
    p(settings.signatory_name || (en ? '[Signatory]' : '[Signataire]'), { align: AlignmentType.RIGHT, run: { bold: true } }),
    p(settings.signatory_title || '', { align: AlignmentType.RIGHT }),
  ];
  const doc = new Document({
    creator: settings.company_name || 'Clausia',
    title: subject,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
