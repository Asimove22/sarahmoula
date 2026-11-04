import { useEffect, useRef, useState } from 'react';
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
  const [job, setJob] = useState<Rec | null>(null);
  const [aiReady, setAiReady] = useState<Rec | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const label = (k: string) => t(CONTRACT_FIELDS.find((f) => f.name === k)?.label ?? EXTRA_LABELS[k] ?? k);
  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  const apply = (out: Rec, f: File | null, notify = true) => {
    setAnalysis(out);
    // Cadre non reconnu : on ne garde pas « NEC4 » par défaut, l'utilisateur choisit.
    setInitial({ ...DEFAULTS, framework: out.values.framework ?? '', ...out.values, title: out.values.title ?? cleanFileTitle(f?.name ?? '') });
    setFormKey((k) => k + 1);
    const n = Object.keys(out.values).length;
    if (notify) toast(n ? t('{n} champ(s) pré-rempli(s) : vérifiez-les avant de créer le contrat', { n }) : out.warning ?? t('Aucune information reconnue : remplissez la fiche'), n ? 'ok' : 'error');
  };
  const stopPolling = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
    setBusy(false);
  };

  const analyze = async (files: File[]) => {
    const f = files[0];
    stopPolling();
    setFile(f);
    setAnalysis(null);
    setAiReady(null);
    setJob({ stage: 'envoi', progress: 1, message: t('Envoi du fichier') });
    setBusy(true);
    try {
      const { job_id } = await api.upload<Rec>('/api/contracts/analyze', [f]);
      let partialShown = false;
      poll.current = setInterval(async () => {
        try {
          const j = await api.get<Rec>(`/api/contracts/analyze/${job_id}`);
          setJob(j);
          // La lecture par règles est prête : la fiche est pré-remplie sans attendre l'IA.
          if (j.partial && !partialShown && j.stage === 'ia') {
            partialShown = true;
            apply(j.partial, f, false);
          }
          if (j.stage === 'terminé') {
            stopPolling();
            if (partialShown && j.result.from_ai?.length) setAiReady(j.result);
            else if (!partialShown) apply(j.result, f);
            else setAnalysis(j.result);
          } else if (j.stage === 'erreur') {
            stopPolling();
            toast(j.error, 'error');
          }
        } catch (e) {
          stopPolling();
          toastError(e);
        }
      }, 800);
    } catch (e) {
      stopPolling();
      setJob(null);
      toastError(e);
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
          label={file ? t('{name} — déposez un autre fichier pour recommencer', { name: file.name }) : t('Déposez le contrat (PDF, Word…) : Clausia le lit et remplit la fiche, vous corrigez si besoin')}
        />
        {job && (busy || job.stage === 'erreur') && <AnalysisProgress job={job} onSkipAi={job.stage === 'ia' ? () => { stopPolling(); setJob(null); } : undefined} />}
        {aiReady && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand-300 bg-white p-3 text-sm">
            <Sparkles size={16} className="text-brand-600" />
            <span className="mr-auto">{t('L’IA a terminé : {n} valeur(s) proposée(s) en plus ou corrigée(s).', { n: aiReady.from_ai.length })}</span>
            <button className="btn-primary" onClick={() => { apply(aiReady, file); setAiReady(null); }}>{t('Appliquer la lecture IA')}</button>
            <button className="btn-ghost" onClick={() => setAiReady(null)}>{t('Garder ma fiche')}</button>
          </div>
        )}
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

const STAGES = [
  { id: 'lecture', label: 'Lecture' },
  { id: 'ocr', label: 'OCR' },
  { id: 'règles', label: 'Repérage' },
  { id: 'ia', label: 'IA' },
  { id: 'terminé', label: 'Terminé' },
];

/** Barre de progression de la lecture / analyse du contrat déposé. */
function AnalysisProgress({ job, onSkipAi }: { job: Rec; onSkipAi?: () => void }) {
  const error = job.stage === 'erreur';
  // L'étape OCR n'apparaît que pour un document scanné.
  const stages = STAGES.filter((s) => s.id !== 'ocr' || job.stage === 'ocr' || job.partial?.ocr || job.result?.ocr);
  const current = stages.findIndex((s) => s.id === job.stage);
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3" role="status" aria-live="polite">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className={error ? 'font-medium text-red-700' : 'font-medium text-slate-700'}>{job.message}</span>
        <span className="tabular-nums text-slate-500">{job.progress} %</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress}>
        <div className={`h-full rounded-full transition-all duration-700 ${error ? 'bg-red-600' : 'bg-brand-600'} ${job.stage === 'ia' ? 'animate-pulse' : ''}`} style={{ width: `${job.progress}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {stages.map((s, i) => (
          <span key={s.id} className={i < current ? 'text-emerald-700' : i === current ? 'font-semibold text-brand-700' : 'text-slate-400'}>
            {i < current ? '✓ ' : ''}{t(s.label)}
          </span>
        ))}
        {onSkipAi && (
          <button type="button" className="ml-auto text-xs text-brand-700 underline" onClick={onSkipAi}>
            {t('Ne pas attendre l’IA (fiche déjà pré-remplie)')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Intitulé tiré du nom de fichier : sans « Microsoft Word - » ni extensions (« ….docx.pdf »). */
function cleanFileTitle(name: string) {
  return name
    .replace(/^Microsoft (?:Word|Excel|PowerPoint)\s*-\s*/i, '')
    .replace(/(?:\.?(?:docx?|pdf|xlsx?|pptx?|odt))+$/i, '')
    .replace(/[_]+/g, ' ')
    .trim();
}
