import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, Sparkles } from 'lucide-react';
import { api, fileUrl, type Rec } from '../api';
import { t } from '../i18n';
import { Modal, toast, toastError } from './ui';

/** Courriers proposés selon le registre d'origine. */
export const LETTERS_BY_ENTITY: Record<string, { id: string; label: string }[]> = {
  early_warnings: [{ id: 'ew_notification', label: 'Notifier (courrier)' }],
  compensation_events: [
    { id: 'ce_notification', label: 'Notification' },
    { id: 'ce_quotation', label: 'Envoi du devis' },
    { id: 'pm_failure_to_reply', label: 'Absence de réponse PM' },
  ],
  correspondence: [{ id: 'reply', label: 'Répondre' }],
  submittals: [{ id: 'visa_transmission', label: 'Transmettre pour visa' }],
  payments: [{ id: 'payment_reminder', label: 'Relancer' }],
  service_orders: [{ id: 'os_reserves', label: 'Émettre des réserves' }],
  claims: [{ id: 'memoire_reclamation', label: 'Mémoire en réclamation' }],
};

export function LetterModal({ contractId, template, entityId, onClose }: { contractId: number; template: string; entityId?: number; onClose: () => void }) {
  const [draft, setDraft] = useState<Rec | null>(null);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState<'' | 'ai' | 'generate'>('');
  const [result, setResult] = useState<Rec | null>(null);
  // Langue du courrier : choisie par le serveur (anglais pour un contrat NEC), modifiable ici.
  const [lang, setLang] = useState<string | undefined>(undefined);

  // onClose change à chaque rendu du parent : on le garde dans une ref pour ne charger l'aperçu qu'une fois.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    api.post('/api/letters/preview', { contract_id: contractId, template, entity_id: entityId, lang }).then(setDraft).catch((e) => {
      toastError(e);
      closeRef.current();
    });
  }, [contractId, template, entityId, lang]);

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const improve = async () => {
    setBusy('ai');
    try {
      const out = await api.post('/api/ai/draft', { contract_id: contractId, template, entity_id: entityId, subject: draft!.subject, body: draft!.body, instructions });
      set('body', out.body);
      toast(t('Texte proposé par l’IA ({name}) : relisez-le avant envoi.', { name: out.provider === 'claude' ? 'Claude' : t('locale') }));
    } catch (e) {
      toastError(e);
    } finally {
      setBusy('');
    }
  };

  const generate = async () => {
    setBusy('generate');
    try {
      setResult(await api.post('/api/letters/generate', { contract_id: contractId, template, entity_id: entityId, ...draft }));
    } catch (e) {
      toastError(e);
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal title={t('Préparer un courrier')} onClose={onClose} wide>
      {!draft ? (
        <div className="text-sm text-slate-500">{t('Préparation…')}</div>
      ) : result ? (
        <div className="space-y-4 text-sm">
          <p>
            {t('Courrier')} <b>{result.correspondence.reference}</b> {t('créé dans le registre des échanges (statut « à envoyer ») et archivé dans la GED.')}
          </p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href={fileUrl(result.document, true)}>
              <Download size={16} /> {t('Télécharger le .docx')}
            </a>
            <Link className="btn-secondary" to={`/contrats/${contractId}?tab=echanges&open=${result.correspondence.id}`} onClick={onClose}>
              {t('Ouvrir l’échange')}
            </Link>
          </div>
          <p className="text-xs text-slate-500">{t('Après envoi, passez l’échange au statut « envoyé » et reportez la date d’envoi dans le registre concerné (date de notification…).')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.languages?.length > 1 && (
              <div className="flex items-center gap-2 text-sm sm:col-span-2">
                <span className="label !mb-0">{t('Langue du courrier')}</span>
                {['fr', 'en'].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      if (l !== draft.lang && (draft.body === '' || confirm(t('Changer de langue régénère le courrier (vos modifications seront perdues). Continuer ?')))) setLang(l);
                    }}
                    className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${draft.lang === l ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {l === 'fr' ? t('Français') : t('English')}
                  </button>
                ))}
              </div>
            )}
            <label className="sm:col-span-2">
              <span className="label">{t('Objet')}</span>
              <input className="input" value={draft.subject} onChange={(e) => set('subject', e.target.value)} />
            </label>
            <label>
              <span className="label">{t('Destinataire (adresse sur plusieurs lignes possible)')}</span>
              <textarea className="input min-h-[64px]" value={draft.recipient} onChange={(e) => set('recipient', e.target.value)} />
            </label>
            <label>
              <span className="label">{t('Copie')}</span>
              <textarea className="input min-h-[64px]" value={draft.cc} onChange={(e) => set('cc', e.target.value)} />
              {draft.channel && <span className="text-xs text-slate-500">{t('Canal prévu par la matrice de communication :')} {draft.channel}</span>}
            </label>
          </div>
          <label className="block">
            <span className="label">{t('Corps du courrier (les passages entre [crochets] sont à compléter)')}</span>
            <textarea className="input min-h-[260px] font-[inherit] leading-relaxed" value={draft.body} onChange={(e) => set('body', e.target.value)} />
          </label>
          <div className="flex flex-wrap items-end gap-2 rounded-md bg-violet-50 p-3">
            <label className="min-w-[240px] flex-1">
              <span className="label">{t('Consigne pour l’IA (facultatif)')}</span>
              <input className="input" placeholder={t('ex. ton plus ferme, rappeler la clause 61.4…')} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </label>
            <button className="btn-secondary" onClick={improve} disabled={busy !== ''}>
              <Sparkles size={16} /> {busy === 'ai' ? t('Rédaction…') : t('Améliorer avec l’IA')}
            </button>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button className="btn-secondary" onClick={onClose}>
              {t('Annuler')}
            </button>
            <button className="btn-primary" onClick={generate} disabled={busy !== ''}>
              <FileText size={16} /> {busy === 'generate' ? t('Génération…') : t('Générer le courrier Word')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
