import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, Plus, Sparkles } from 'lucide-react';
import { api, type Rec } from '../api';
import { EntityForm } from '../components/EntityForm';
import { Badge, Empty, FileDrop, Modal, toast, toastError } from '../components/ui';
import { CONTRACT_FIELDS, CONTRACT_STATUSES, frameworkLabel } from '../schemas';
import { fmtDate, fmtMoney } from '../format';
import { t } from '../i18n';

const CLOSED = ['clôturé', 'résilié', 'archivé'];

export function Contracts() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('en_cours');
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const creating = params.get('nouveau') === '1';

  useEffect(() => {
    api.get('/api/contracts').then(setRows).catch(toastError);
  }, []);

  const query = q.toLowerCase();
  const shown = rows.filter(
    (c) =>
      (status === '' || (status === 'en_cours' ? !CLOSED.includes(c.status) : c.status === status)) &&
      (!query || `${c.title} ${c.reference ?? ''} ${c.counterparty ?? ''} ${c.project ?? ''}`.toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">{t('Contrats')}</h1>
        <a className="btn-secondary" href="/api/export/contracts.csv">
          <FileSpreadsheet size={16} /> {t('Excel')}
        </a>
        <button className="btn-primary" onClick={() => setParams({ nouveau: '1' })}>
          <Plus size={16} /> {t('Nouveau contrat')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder={t('Rechercher un contrat…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="en_cours">{t('En cours')}</option>
          <option value="">{t('Tous')}</option>
          {CONTRACT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <Empty>{rows.length ? t('Aucun contrat ne correspond au filtre.') : t('Aucun contrat pour le moment : créez le premier.')}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">{t('Contrat')}</th>
                <th className="th">{t('Cadre')}</th>
                <th className="th">{t('Cocontractant')}</th>
                <th className="th">{t('Montant')}</th>
                <th className="th">{t('Fin')}</th>
                <th className="th">{t('Suivi')}</th>
                <th className="th">{t('Statut')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-brand-50/40" onClick={() => navigate(`/contrats/${c.id}`)}>
                  <td className="td">
                    <Link to={`/contrats/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.title}
                    </Link>
                    <div className="text-xs text-slate-400">{[c.reference, c.project].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="td whitespace-nowrap">
                    {frameworkLabel(c.framework)}
                    {c.nec_option && ` opt. ${c.nec_option}`}
                  </td>
                  <td className="td">{c.counterparty ?? '—'}</td>
                  <td className="td whitespace-nowrap">{fmtMoney(c.amount, c.currency)}</td>
                  <td className="td whitespace-nowrap">{fmtDate(c.end_date || c.completion_date)}</td>
                  <td className="td whitespace-nowrap text-xs text-slate-500">
                    {c.documents_count} {t('doc.')}
                    {c.open_ew_count > 0 && <span className="ml-2 text-amber-700">{c.open_ew_count} {t('EW')}</span>}
                    {c.open_ce_count > 0 && <span className="ml-2 text-brand-700">{c.open_ce_count} {t('CE')}</span>}
                    {c.pending_replies_count > 0 && <span className="ml-2 text-red-600">{c.pending_replies_count} {t('rép.')}</span>}
                  </td>
                  <td className="td">
                    <Badge value={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <NewContract onClose={() => setParams({})} onCreated={(id) => navigate(`/contrats/${id}?tab=synthese`)} />}
    </div>
  );
}

const DEFAULTS: Rec = { framework: 'NEC4', status: 'actif', currency: 'EUR', ce_notify_weeks: 8, pm_reply_weeks: 1, quote_weeks: 3, pm_quote_reply_weeks: 2, pm_programme_reply_weeks: 2, visa_days: 15 };
const EXTRA_LABELS: Record<string, string> = { rev_terms: 'Formule de révision (indices)', rev_fixed: 'Formule de révision (partie fixe)', rev_base_month: 'Mois zéro', rev_enabled: 'Révision des prix' };

/** Création d'un contrat : dépôt du document, lecture automatique, fiche pré-remplie à vérifier. */
function NewContract({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [initial, setInitial] = useState<Rec>(DEFAULTS);
  const [formKey, setFormKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Rec | null>(null);
  const [busy, setBusy] = useState(false);
  const label = (k: string) => t(CONTRACT_FIELDS.find((f) => f.name === k)?.label ?? EXTRA_LABELS[k] ?? k);

  const analyze = async (files: File[]) => {
    const f = files[0];
    setFile(f);
    setBusy(true);
    try {
      const out = await api.upload<Rec>('/api/contracts/analyze', [f]);
      setAnalysis(out);
      setInitial({ ...DEFAULTS, ...out.values, title: out.values.title ?? f.name.replace(/\.[^.]+$/, '') });
      setFormKey((k) => k + 1);
      const n = Object.keys(out.values).length;
      toast(n ? t('{n} champ(s) pré-rempli(s) : vérifiez-les avant de créer le contrat', { n }) : out.warning ?? t('Aucune information reconnue : remplissez la fiche'), n ? 'ok' : 'error');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const create = async (values: Rec) => {
    try {
      // La formule de révision lue dans le document n'est pas dans le formulaire : on la transmet aussi.
      const rev = Object.fromEntries(Object.entries(initial).filter(([k]) => k.startsWith('rev_')));
      const created = await api.post<Rec>('/api/contracts', { ...rev, ...values });
      if (file) await api.upload('/api/documents/upload', [file], { contract_id: created.id, category: 'Contrat', title: values.title });
      toast(file ? t('Contrat créé et document archivé dans la GED') : t('Contrat créé. Déposez maintenant le contrat signé et ses annexes.'));
      onCreated(created.id);
    } catch (e) {
      toastError(e);
    }
  };

  const filled = analysis ? Object.keys(analysis.values) : [];
  return (
    <Modal title={t('Nouveau contrat')} onClose={onClose} wide>
      <div className="mb-4 space-y-2">
        <FileDrop
          multiple={false}
          onFiles={analyze}
          label={busy ? t('Lecture du contrat… (un scan peut prendre quelques minutes)') : file ? t('{name} — déposez un autre fichier pour recommencer', { name: file.name }) : t('Déposez le contrat (PDF, Word…) : Clausia le lit et remplit la fiche, vous corrigez si besoin')}
        />
        {analysis && (
          <div className="rounded-md border border-brand-200 bg-brand-50/40 p-3 text-sm">
            <div className="mb-1 flex flex-wrap items-center gap-2 font-medium">
              <Sparkles size={16} className="text-brand-600" />
              {filled.length ? t('{n} champ(s) pré-rempli(s) – lecture : {method}', { n: filled.length, method: t(analysis.method) }) : t(analysis.warning ?? 'Aucune information reconnue')}
              {analysis.ocr && <Badge value="OCR" />}
            </div>
            {analysis.ai_error && <p className="text-xs text-amber-700">{t('IA indisponible, lecture par règles seulement')} : {analysis.ai_error}</p>}
            {analysis.duration && <p className="text-xs text-slate-600">{t('Délai d’exécution lu')} : {analysis.duration}</p>}
            {filled.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-slate-600">{t('Voir d’où viennent les valeurs')}</summary>
                <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs">
                  {filled.map((k) => (
                    <li key={k}>
                      <b>{label(k)}</b> : {String(analysis.values[k])}
                      {analysis.from_ai?.includes(k) && <span className="text-brand-700"> · IA</span>}
                      {analysis.sources[k] && <div className="text-slate-500">« {analysis.sources[k]} »</div>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-1 text-xs text-slate-500">{t('Valeurs proposées à partir du document : contrôlez-les, tout reste modifiable ci-dessous.')}</p>
          </div>
        )}
      </div>
      <EntityForm key={formKey} fields={CONTRACT_FIELDS} initial={initial} submitLabel="Créer le contrat" onCancel={onClose} onSubmit={create} />
    </Modal>
  );
}
