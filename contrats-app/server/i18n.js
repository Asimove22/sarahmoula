/**
 * Traduction anglaise des points d'attention et des échéances calculés par le serveur.
 * Le français reste la langue de référence : les messages sont produits en français puis traduits
 * à la sortie quand l'interface est en anglais (en-tête X-Lang: en).
 */

const EXACT = {
  // Points d'attention : détails fixes
  'Archivez-les pour fiabiliser la revue de contrat et l’assistant IA.': 'Archive them so the contract review and the AI assistant are reliable.',
  'Scan de mauvaise qualité ou OCR désactivé : déposez si possible une version PDF native ou un scan plus net (300 dpi).': 'Poor-quality scan or OCR disabled: upload a native PDF or a sharper scan (300 dpi) if possible.',
  'Vérifiez les passages importants dans le document original avant de vous fier à la recherche ou à l’IA.': 'Check important passages in the original document before relying on search or the AI.',
  'De nouveaux événements touchent des points de votre revue de contrat.': 'New events affect items of your contract review.',
  'Revue de contrat non réalisée': 'Contract review not carried out',
  'Lancez la revue (modèle de check-list ou analyse IA) pour identifier les clauses à risque.': 'Run the review (checklist template or AI analysis) to identify risky clauses.',
  'Aucun intervenant renseigné': 'No stakeholders recorded',
  'Renseignez les intervenants pour alimenter le RACI et la matrice de communication.': 'Record the stakeholders to feed the RACI and the communication matrix.',
  'Matrice RACI vide': 'RACI matrix empty',
  'Définissez qui réalise, approuve, est consulté et informé pour les activités clés.': 'Define who is responsible, accountable, consulted and informed for key activities.',
  'Matrice de communication vide': 'Communication matrix empty',
  'Elle permet de proposer automatiquement les destinataires des courriers.': 'It is used to suggest letter addressees automatically.',
  'Groupement sans membres': 'Consortium without members',
  'Saisissez les cotraitants et leurs quotes-parts.': 'Enter the co-contractors and their shares.',
  'Vérifiez la répartition avec la convention de groupement.': 'Check the split against the consortium agreement.',
  'Aucun mandataire désigné dans le groupement': 'No lead member appointed in the consortium',
  'Vous pouvez notifier l’absence de réponse (cl. 61.4) : sans réponse sous 2 semaines, l’événement est réputé accepté.': 'You may notify the failure to reply (cl. 61.4): without a reply within 2 weeks, the event is deemed accepted.',
  'Notifiez un Early Warning et identifiez les Compensation Events éventuels.': 'Notify an early warning and identify any compensation events.',
  'Analysez les causes et, si elles ne vous sont pas imputables, demandez une prolongation de délai.': 'Analyse the causes and, if you are not responsible, request an extension of time.',
  'Toute journée perdue sur le chemin critique décale l’achèvement.': 'Every day lost on the critical path delays completion.',
  'Aucun programme soumis': 'No programme submitted',
  'Sans premier programme contenant les informations requises, un quart du Price for Work Done to Date peut être retenu (NEC3 cl. 50.3 / NEC4 cl. 50.5).': 'Without a first programme showing the required information, one quarter of the Price for Work Done to Date may be retained (NEC3 cl. 50.3 / NEC4 cl. 50.5).',
  'Aucun programme accepté à ce jour': 'No programme accepted to date',
  'Suivez les motifs de non-acceptation et resoumettez.': 'Address the reasons for non-acceptance and resubmit.',
  'Relancez et réclamez les intérêts moratoires si le contrat ou la réglementation le prévoit.': 'Chase payment and claim late-payment interest where the contract or regulations provide for it.',
  'Vérifiez les seuils de modification prévus par le contrat et la réglementation applicable.': 'Check the modification thresholds set by the contract and the applicable regulations.',
  'Montant en jeu sur les Compensation Events non encore implémentés.': 'Amount at stake on compensation events not yet implemented.',
  'Garantie de parfait achèvement échue': 'Completion guarantee period expired',
  'Demandez la libération de la retenue de garantie (ou de la caution qui la remplace).': 'Request release of the retention (or of the bond replacing it).',
  'Aucune date d’achèvement ou de fin renseignée': 'No completion or end date recorded',
  'Les alertes de délai et de préavis ne peuvent pas être calculées.': 'Time and notice alerts cannot be calculated.',
  'CCAG applicable non renseigné': 'Applicable CCAG not set',
  'Indiquez le CCAG visé par le CCAP (Travaux, FCS, MOE, PI, TIC, MI) pour activer les règles correspondantes.': 'Set the CCAG referred to in the CCAP (Works, Supplies & services, MOE, Intellectual services, ICT, Industrial) to activate its rules.',
  'Type d’acheteur non renseigné': 'Buyer type not set',
  'Il détermine le délai global de paiement légal (30, 50 ou 60 jours).': 'It sets the statutory payment period (30, 50 or 60 days).',
  'CCP, art. R2191-32.': 'Public Procurement Code (CCP), art. R2191-32.',
  'Une clause fixant un délai plus long est sans effet : le délai légal s’applique (CCP, art. R2192-10 et suivants).': 'A clause setting a longer period has no effect: the statutory period applies (CCP, art. R2192-10 et seq.).',
  'Avance non renseignée': 'Advance payment not recorded',
  'Montant > 50 000 € HT et délai > 2 mois : l’avance est en principe obligatoire, sauf renonciation (CCP, art. R2191-3). Vérifiez l’acte d’engagement.': 'Amount > €50,000 excl. VAT and duration > 2 months: an advance is in principle mandatory unless waived (CCP, art. R2191-3). Check the form of agreement.',
  'Pour une modification due à des circonstances imprévues, chaque modification est plafonnée à 50 % (CCP, art. R2194-3).': 'For a modification due to unforeseen circumstances, each modification is capped at 50 % (CCP, art. R2194-3).',
  'Il ne peut pas intervenir avant l’acceptation et l’agrément de ses conditions de paiement par l’acheteur (DC4).': 'It may not start before the buyer accepts it and approves its payment terms (DC4).',
  'Montant ≥ 600 € TTC : le sous-traitant de premier rang a droit au paiement direct (CCP, art. R2193-10).': 'Amount ≥ €600 incl. VAT: the first-tier subcontractor is entitled to direct payment (CCP, art. R2193-10).',
  'Passé ce délai, l’ordre de service est réputé accepté sans réserve.': 'After this period, the service order is deemed accepted without reservation.',
  'Règle par défaut du CCAG Travaux 2021 (1/3000 du montant HT par jour), sauf CCAP contraire, hors plafond éventuel et causes exonératoires. Les retards non imputables doivent être documentés.': 'Default rule of CCAG Works 2021 (1/3000 of the amount excl. VAT per day), unless the CCAP says otherwise, before any cap and excusable causes. Delays not attributable to you must be documented.',
  'Taux BCE non renseigné': 'ECB rate not set',
  'Saisissez-le dans Paramètres pour chiffrer automatiquement les intérêts moratoires des paiements en retard.': 'Enter it in Settings to calculate late-payment interest automatically.',
  // Échéances : titres fixes
  'Fin du contrat': 'Contract end',
  'Date limite de dénonciation (reconduction tacite)': 'Deadline to terminate (tacit renewal)',
  'Date limite de préavis': 'Notice deadline',
  'Fin de la garantie de parfait achèvement (libération de la retenue de garantie)': 'End of the completion guarantee period (release of retention)',
  'Fin de la garantie biennale de bon fonctionnement': 'End of the two-year equipment guarantee',
  'Soumission du prochain programme révisé (cl. 32.2)': 'Submission of the next revised programme (cl. 32.2)',
  'Transmettre le projet de décompte final': 'Submit the draft final account',
  'Retourner le décompte général signé (réserves éventuelles), sinon il est réputé accepté': 'Return the general final account signed (with any reservations), otherwise it is deemed accepted',
  'Remboursement de la retenue de garantie (au plus tard 1 mois après la fin de la garantie)': 'Release of retention (no later than 1 month after the end of the guarantee period)',
  // Natures d'échéance
  contrat: 'contract',
  programme: 'programme',
  visa: 'review',
  paiement: 'payment',
  'marché public': 'public contract',
  'Autres thèmes': 'Other themes',
};

/** Messages paramétrés : [motif français, remplacement anglais]. */
const PATTERNS = [
  [/^Pièces de référence manquantes : (.+)$/, 'Missing reference documents: $1'],
  [/^(\d+) document\(s\) illisible\(s\) même après OCR$/, '$1 document(s) unreadable even after OCR'],
  [/^(\d+) document\(s\) lus par OCR avec une confiance faible$/, '$1 document(s) read by OCR with low confidence'],
  [/^(\d+) mise\(s\) à jour de la revue à valider$/, '$1 review update(s) to validate'],
  [/^(\d+) clause\(s\) à risque élevé non traitée\(s\)$/, '$1 high-risk clause(s) not addressed'],
  [/^Quotes-parts du groupement : (.+) % au lieu de 100 %$/, 'Consortium shares: $1 % instead of 100 %'],
  [/^(\d+) Early Warning\(s\) sans revue planifiée$/, '$1 early warning(s) without a planned review'],
  [/^(.+) : délai de notification dépassé$/, '$1: notification period exceeded'],
  [/^Limite au (\S+)\. Notifiez sans attendre et documentez la date de connaissance\.$/, 'Deadline was $1. Notify without delay and document the date the event became known.'],
  [/^(.+) : pas de réponse du PM depuis le (\S+)$/, '$1: no PM reply since $2'],
  [/^(.+) : devis en retard \(attendu le (\S+)\)$/, '$1: quotation late (due on $2)'],
  [/^(\d+) courrier\(s\) reçu\(s\) non traité\(s\) depuis plus de 7 jours$/, '$1 received letter(s) not processed for more than 7 days'],
  [/^Le dernier planning prévoit l’achèvement (-?\d+) j après la date contractuelle$/, 'The latest programme forecasts completion $1 days after the contract date'],
  [/^Fin prévue (\S+) pour (\S+)\. (.+)$/, (m, a, b, rest) => `Planned finish ${a} against ${b}. ${tr(rest)}`],
  [/^Glissement de (\d+) j entre les deux derniers plannings$/, '$1-day slippage between the last two programmes'],
  [/^(\d+) tâche\(s\) critique\(s\) en retard dans le dernier planning$/, '$1 critical activity(ies) late in the latest programme'],
  [/^(\d+) visa\(s\) en retard$/, '$1 late review(s)'],
  [/^(.*) — un retard de visa peut justifier une demande de délai ou de rémunération\.$/, '$1 — a late review may justify a claim for time or money.'],
  [/^(\d+) document\(s\) refusé\(s\) à resoumettre$/, '$1 rejected document(s) to resubmit'],
  [/ ind\. /g, ' rev. '],
  [/^(\d+) paiement\(s\) en retard$/, '$1 late payment(s)'],
  [/^Montant actualisé : \+(.+) % par rapport au montant initial$/, 'Current amount: +$1 % compared with the initial amount'],
  [/^CE en cours chiffrés : (.+)$/, 'Open CEs quoted: $1'],
  [/^Retenue de garantie de (.+) % : au-delà du plafond légal de 5 %$/, 'Retention of $1 %: above the statutory 5 % cap'],
  [/^Délai de paiement de (\d+) j supérieur au délai légal de (\d+) j$/, 'Payment period of $1 days exceeds the statutory $2 days'],
  [/^Avenants cumulés : \+(.+) % du montant initial$/, 'Cumulative amendments: +$1 % of the initial amount'],
  [/^Au-delà de (\d+) %, la modification ne relève plus du « faible montant » \(CCP, art\. R2194-8\) et doit se fonder sur un autre cas de modification\.$/, 'Beyond $1 %, the modification no longer qualifies as “low value” (CCP, art. R2194-8) and must rely on another modification ground.'],
  [/^Avenant (.+) supérieur à 50 % du montant initial$/, 'Amendment $1 above 50 % of the initial amount'],
  [/^Sous-traitant (.+) non agréé$/, 'Subcontractor $1 not approved'],
  [/^Paiement direct obligatoire pour (.+)$/, 'Direct payment mandatory for $1'],
  [/^OS (.+) : réserves à émettre avant le (\S+)$/, 'Service order $1: reservations to issue before $2'],
  [/^Pénalités théoriques : (.+) € pour (\d+) j de retard$/, 'Theoretical delay damages: €$1 for $2 days of delay'],
  // Échéances
  [/^(.+) – revue : (.+)$/, '$1 – review: $2'],
  [/^(.+) – limite de notification \(forclusion\)$/, '$1 – notification deadline (time bar)'],
  [/^(.+) – réponse du PM attendue \(cl\. 31\.3\)$/, '$1 – PM reply due (cl. 31.3)'],
  [/^(.+) – réponse du PM attendue$/, '$1 – PM reply due'],
  [/^(.+) – remise du devis$/, '$1 – quotation due'],
  [/^(.+) – réponse du PM au devis$/, '$1 – PM reply to quotation'],
  [/^Réponse à « (.+) »(.*)$/, 'Reply to “$1”$2'],
  [/^Visa attendu : (.+)$/, 'Review due: $1'],
  [/^Paiement attendu : situation(.*)$/, 'Payment due: application$1'],
  [/^Paiement attendu : (.+)$/, 'Payment due: $1'],
  [/^Réserves sur l’OS (.*) : (.+)$/, 'Reservations on service order $1: $2'],
  [/^Mémoire en réclamation (.*) à transmettre : (.+)$/, 'Statement of claim $1 to submit: $2'],
  [/^Réponse de l’acheteur au mémoire (.*) \(silence = rejet\)$/, 'Buyer’s reply to claim $1 (silence = rejection)'],
];

function tr(s) {
  if (typeof s !== 'string' || !s) return s;
  if (EXACT[s]) return EXACT[s];
  let out = s;
  for (const [re, rep] of PATTERNS) {
    if (re.global) out = out.replace(re, rep);
    else if (re.test(out)) return out.replace(re, rep);
  }
  return out;
}

export const wantsEnglish = (req) => String(req.get?.('x-lang') ?? '').toLowerCase() === 'en';

/** Traduit les champs textuels d'un point d'attention ou d'une échéance. */
export function localizeItem(item, en) {
  if (!en || !item) return item;
  return { ...item, title: tr(item.title), detail: tr(item.detail) };
}

export const localizeList = (list, en) => (en ? list.map((i) => localizeItem(i, en)) : list);
export const translate = tr;
