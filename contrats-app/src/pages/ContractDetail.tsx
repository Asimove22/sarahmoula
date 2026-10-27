import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarPlus, ChevronLeft, Mail, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { api, type Rec } from '../api';
import { DocumentsPanel } from '../components/DocumentsPanel';
import { DeadlineList } from '../components/DeadlineList';
import { EntityForm } from '../components/EntityForm';
import { Insights } from '../components/Insights';
import { LetterModal } from '../components/LetterModal';
import { RegisterPanel } from '../components/RegisterPanel';
import { Badge, FileDrop, Modal, toast, toastError } from '../components/ui';
import { CE_FIELDS, CONTRACT_FIELDS, CORRESPONDENCE_FIELDS, ENTITY_LABELS, EW_FIELDS, frameworkLabel, isNec } from '../schemas';
import { addDaysIso, daysFromToday, fmtDate, fmtDateTime, fmtMoney, relativeDays, todayIso } from '../format';
import { ReviewTab } from './contract/ReviewTab';
import { OrganisationTab } from './contract/OrganisationTab';
import { PlanningTab } from './contract/PlanningTab';
import { FinanceSummary, FinanceTab } from './contract/FinanceTab';
import { VisasTab } from './contract/VisasTab';
import { AssistantTab } from './contract/AssistantTab';

const TABS = [
  { id: 'synthese', label: 'Synthèse' },
  { id: 'revue', label: 'Revue' },
  { id: 'documents', label: 'Documents' },
  { id: 'organisation', label: 'Organisation' },
  { id: 'planning', label: 'Planning' },
  { id: 'visas', label: 'Visas' },
  { id: 'finances', label: 'Finances' },
  { id: 'ew', label: 'Early Warnings', nec: true },
  { id: 'ce', label: 'Compensation Events', nec: true },
  { id: 'echanges', label: 'Échanges' },
  { id: 'assistant', label: 'Assistant IA' },
  { id: 'journal', label: 'Historique' },
];

const CONTRACT_LETTERS = [
  { id: 'extension_request', label: 'Demande de prolongation de délai', frameworks: ['FR_PUBLIC', 'FR_PRIVE', 'COMMERCIAL'] },
  { id: 'formal_notice', label: 'Mise en demeure', frameworks: [] as string[] },
];

const dateCell = (key: string) => (r: Rec) => fmtDate(r[key]);
const statusCell = (r: Rec) => <Badge value={r.status} />;

function DueCell({ date }: { date?: string | null }) {
  if (!date) return <>—</>;
  const n = daysFromToday(date);
  const cls = n < 0 ? 'text-red-600 font-medium' : n <= 7 ? 'text-amber-700 font-medium' : '';
  return (
    <span className={cls}>
      {fmtDate(date)} <span className="text-xs">({relativeDays(date)})</span>
    </span>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm">{children || '—'}</dd>
    </div>
  );
}

export function ContractDetail() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Rec | null>(null);
  const [deadlines, setDeadlines] = useState<Rec[]>([]);
  const [insights, setInsights] = useState<Rec[]>([]);
  const [editing, setEditing] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const tab = params.get('tab') ?? 'synthese';
  const openId = params.get('open') ? Number(params.get('open')) : undefined;
  const entity = params.get('e') ?? undefined;

  const load = useCallback(() => {
    api.get<Rec>(`/api/contracts/${id}`).then(setContract).catch(toastError);
    api.get(`/api/deadlines?contract_id=${id}`).then(setDeadlines).catch(toastError);
    api.get(`/api/insights?contract_id=${id}`).then(setInsights).catch(toastError);
    setRefreshKey((k) => k + 1);
  }, [id]);
  useEffect(load, [load]);

  if (!contract) return <div className="text-sm text-slate-500">Chargement…</div>;
  const nec = isNec(contract);
  const tabs = TABS.filter((t) => !t.nec || nec);
  const goTab = (t: string, open?: number) => setParams(open ? { tab: t, open: String(open) } : { tab: t });
  const alerts = (t: string) => insights.filter((i) => i.tab === t && i.level !== 'info').length;

  const removeContract = async () => {
    const answer = prompt(`Supprimer le contrat et TOUS ses registres ?\nLes fichiers seront déplacés dans la corbeille.\n\nTapez SUPPRIMER pour confirmer.\n(Conseil : préférez le statut « archivé ».)`);
    if (answer !== 'SUPPRIMER') return;
    await api.del(`/api/contracts/${id}`);
    toast('Contrat supprimé');
    navigate('/contrats');
  };

  return (
    <div className="space-y-4">
      <Link to="/contrats" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ChevronLeft size={16} /> Contrats
      </Link>

      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">{contract.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {contract.reference && <span>{contract.reference}</span>}
            <span>
              · {frameworkLabel(contract.framework)}
              {contract.nec_option && ` option ${contract.nec_option}`}
            </span>
            {contract.counterparty && <span>· {contract.counterparty}</span>}
            {contract.group_type && <span>· groupement {contract.group_type}</span>}
            <Badge value={contract.status} />
          </div>
        </div>
        <a className="btn-secondary" href={`/api/calendar.ics?contract_id=${id}`}>
          <CalendarPlus size={16} /> Agenda
        </a>
        <button className="btn-secondary" onClick={() => setEditing(true)}>
          <Pencil size={16} /> Modifier
        </button>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => goTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
            {alerts(t.id) > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{alerts(t.id)}</span>}
          </button>
        ))}
      </nav>

      {tab === 'synthese' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <section className="card p-4">
              <h2 className="mb-2 font-semibold">Points d’attention ({insights.length})</h2>
              <Insights items={insights} showContract={false} limit={8} />
            </section>
            <section className="card p-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
                <Info label="Mon rôle">{contract.my_role}</Info>
                <Info label="Cocontractant">{contract.counterparty}</Info>
                <Info label="Projet">{contract.project}</Info>
                <Info label="Montant HT initial">{fmtMoney(contract.amount, contract.currency)}</Info>
                <Info label="Signature">{fmtDate(contract.signature_date)}</Info>
                <Info label="Démarrage">{fmtDate(contract.start_date)}</Info>
                <Info label="Achèvement">{fmtDate(contract.completion_date)}</Info>
                <Info label="Fin / échéance">{fmtDate(contract.end_date)}</Info>
                <Info label="Réception">{fmtDate(contract.reception_date)}</Info>
                <Info label="Préavis">
                  {contract.notice_period_days ? `${contract.notice_period_days} j${contract.tacit_renewal ? ' · reconduction tacite' : ''}` : contract.tacit_renewal ? 'Reconduction tacite' : '—'}
                </Info>
                <Info label="Paiement / retenue">
                  {[contract.payment_days && `${contract.payment_days} j`, contract.retention_percent && `RG ${contract.retention_percent} %`].filter(Boolean).join(' · ')}
                </Info>
                <Info label="Pénalités">{contract.penalty_terms}</Info>
                <Info label="Révision des prix">{contract.price_revision}</Info>
                <Info label="Project Manager / MOE">{contract.project_manager}</Info>
                <Info label="Délai de visa">{contract.visa_days ? `${contract.visa_days} j` : ''}</Info>
                {nec && (
                  <Info label="Délais NEC (sem.)">
                    notif. CE {contract.ce_notify_weeks} · rép. PM {contract.pm_reply_weeks} · devis {contract.quote_weeks} · rép. devis {contract.pm_quote_reply_weeks}
                  </Info>
                )}
                <Info label="IA">{contract.ai_allow_cloud ? 'Claude autorisé (cloud)' : 'Locale uniquement'}</Info>
              </dl>
              {contract.contacts && <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-3 text-sm">{contract.contacts}</p>}
              {contract.notes && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{contract.notes}</p>}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {CONTRACT_LETTERS.filter((l) => !l.frameworks.length || l.frameworks.includes(contract.framework)).map((l) => (
                  <button key={l.id} className="btn-secondary" onClick={() => setLetter(l.id)}>
                    <Mail size={16} /> {l.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
          <div className="min-w-0 space-y-4">
            <section className="card p-4">
              <h2 className="mb-2 font-semibold">Finances</h2>
              <FinanceSummary contract={contract} refreshKey={refreshKey} compact />
            </section>
            <section className="card p-4">
              <h2 className="mb-2 font-semibold">Échéances du contrat</h2>
              <DeadlineList items={deadlines} showContract={false} empty="Aucune échéance ouverte." />
            </section>
          </div>
        </div>
      )}

      {tab === 'revue' && <ReviewTab contract={contract} openId={openId} onChange={load} />}
      {tab === 'documents' && <DocumentsPanel contractId={id} defaultCategory="Contrat" />}
      {tab === 'organisation' && <OrganisationTab contract={contract} openId={openId} onChange={load} />}
      {tab === 'planning' && <PlanningTab contract={contract} openId={openId} entity={entity} onChange={load} />}
      {tab === 'visas' && <VisasTab contract={contract} openId={openId} onChange={load} onOpen={(o) => goTab('visas', o)} />}
      {tab === 'finances' && <FinanceTab contract={contract} openId={openId} entity={entity} onChange={load} />}

      {tab === 'ew' && (
        <RegisterPanel
          table="early_warnings"
          contractId={id}
          title="Registre des Early Warnings"
          addLabel="Notifier un Early Warning"
          emptyText="Aucun Early Warning. Notifiez dès qu'un risque peut affecter le prix, le délai, une Key Date ou la performance de l'ouvrage."
          fields={EW_FIELDS}
          defaults={{ status: 'ouvert', date_notified: todayIso(), raised_by: contract.my_role === 'Entrepreneur' ? 'Entrepreneur' : undefined }}
          docLink="early_warning_id"
          docCategory="Échange"
          openId={openId}
          onChange={load}
          columns={[
            { key: 'number', label: 'N°', className: 'whitespace-nowrap font-medium' },
            { key: 'title', label: 'Objet' },
            { key: 'raised_by', label: 'Par' },
            { key: 'date_notified', label: 'Notifié', render: dateCell('date_notified'), className: 'whitespace-nowrap' },
            {
              key: 'effects',
              label: 'Effets',
              render: (r) =>
                [r.affects_price && 'Prix', r.affects_completion && 'Délai', r.affects_key_date && 'Key Date', r.affects_performance && 'Perf.'].filter(Boolean).join(', ') || '—',
            },
            { key: 'impact', label: 'Gravité' },
            { key: 'next_review_date', label: 'Prochaine revue', render: (r) => (r.status === 'ouvert' ? <DueCell date={r.next_review_date} /> : '—'), className: 'whitespace-nowrap' },
            { key: 'status', label: 'Statut', render: statusCell },
          ]}
          formFooter={(ew, close) =>
            ew.status === 'ouvert' ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    const ce = await api.post('/api/compensation_events', {
                      contract_id: id,
                      title: ew.title,
                      description: ew.description,
                      early_warning_id: ew.id,
                      notified_by: contract.my_role === 'Entrepreneur' ? 'Entrepreneur' : undefined,
                      date_aware: ew.date_notified,
                      status: 'notifié',
                    });
                    await api.put(`/api/early_warnings/${ew.id}`, { status: 'converti en CE', closed_date: todayIso() });
                    close();
                    toast(`${ce.number} créé à partir de ${ew.number}`);
                    goTab('ce', ce.id);
                  } catch (e) {
                    toastError(e);
                  }
                }}
              >
                Convertir en CE →
              </button>
            ) : null
          }
        />
      )}

      {tab === 'ce' && (
        <RegisterPanel
          table="compensation_events"
          contractId={id}
          title="Registre des Compensation Events"
          addLabel="Nouveau Compensation Event"
          emptyText="Aucun Compensation Event."
          fields={CE_FIELDS}
          defaults={{ status: 'notifié', notified_by: contract.my_role === 'Entrepreneur' ? 'Entrepreneur' : undefined }}
          docLink="compensation_event_id"
          docCategory="Échange"
          openId={openId}
          onChange={load}
          rowClassName={(r) => (r.time_barred_risk ? 'bg-red-50' : '')}
          columns={[
            { key: 'number', label: 'N°', className: 'whitespace-nowrap font-medium' },
            {
              key: 'title',
              label: 'Objet',
              render: (r) => (
                <>
                  {r.title}
                  {r.time_barred_risk && (
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle size={12} /> Délai de notification de {contract.ce_notify_weeks} sem. dépassé (risque de forclusion)
                    </div>
                  )}
                </>
              ),
            },
            { key: 'clause', label: 'Clause' },
            { key: 'date_notified', label: 'Notifié', render: dateCell('date_notified'), className: 'whitespace-nowrap' },
            {
              key: 'next',
              label: 'Prochaine échéance',
              className: 'whitespace-nowrap',
              render: (r) => {
                const next = [
                  !r.date_notified && r.notified_by === 'Entrepreneur' && r.notify_deadline && ['Notifier', r.notify_deadline],
                  r.pm_reply_due && ['Rép. PM', r.pm_reply_due],
                  r.quotation_due && ['Devis', r.quotation_due],
                  r.pm_quote_reply_due && ['Rép. devis', r.pm_quote_reply_due],
                ].filter(Boolean) as [string, string][];
                if (!next.length || ['implémenté', 'rejeté', 'retiré'].includes(r.status)) return '—';
                const [label, date] = next.sort((a, b) => a[1].localeCompare(b[1]))[0];
                return (
                  <>
                    <span className="text-xs text-slate-500">{label} </span>
                    <DueCell date={date} />
                  </>
                );
              },
            },
            { key: 'amount', label: 'Montant', render: (r) => fmtMoney(r.assessed_amount ?? r.quoted_amount, contract.currency), className: 'whitespace-nowrap' },
            { key: 'status', label: 'Statut', render: statusCell },
          ]}
          formFooter={(ce) => (
            <span className="text-xs text-slate-500">
              {ce.notify_deadline && <>Limite de notification : {fmtDate(ce.notify_deadline)}. </>}
              {ce.pm_reply_due && <>Réponse PM attendue : {fmtDate(ce.pm_reply_due)}. </>}
              {ce.quotation_due && <>Devis à remettre : {fmtDate(ce.quotation_due)}. </>}
              {ce.pm_quote_reply_due && <>Réponse au devis : {fmtDate(ce.pm_quote_reply_due)}.</>}
            </span>
          )}
        />
      )}

      {tab === 'echanges' && <CorrespondenceTab contract={contract} openId={openId} onChange={load} onGoTab={goTab} />}
      {tab === 'assistant' && <AssistantTab contract={contract} />}
      {tab === 'journal' && <JournalTab contractId={id} />}

      {editing && (
        <Modal title="Modifier le contrat" onClose={() => setEditing(false)}>
          <EntityForm
            fields={CONTRACT_FIELDS}
            initial={contract}
            onCancel={() => setEditing(false)}
            footer={
              <button type="button" className="btn-danger" onClick={removeContract}>
                <Trash2 size={16} /> Supprimer le contrat
              </button>
            }
            onSubmit={async (values) => {
              try {
                await api.put(`/api/contracts/${id}`, values);
                setEditing(false);
                toast('Contrat mis à jour');
                load();
              } catch (e) {
                toastError(e);
              }
            }}
          />
        </Modal>
      )}
      {letter && <LetterModal contractId={id} template={letter} onClose={() => { setLetter(null); load(); }} />}
    </div>
  );
}

function CorrespondenceTab({ contract, openId, onChange, onGoTab }: { contract: Rec; openId?: number; onChange: () => void; onGoTab: (tab: string, open?: number) => void }) {
  const contractId = contract.id;
  const [direction, setDirection] = useState('entrant');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [triage, setTriage] = useState<{ message: Rec; result: Rec; close: () => void } | null>(null);

  const importFiles = async (files: File[]) => {
    setBusy(true);
    try {
      const created = await api.upload('/api/correspondence/import', files, { contract_id: contractId, direction });
      const attachments = created.reduce((n, c) => n + (c.attachments ?? 0), 0);
      toast(`${created.length} échange(s) importé(s)${attachments ? `, ${attachments} pièce(s) jointe(s) archivée(s)` : ''}`);
      setRefreshKey((k) => k + 1);
      onChange();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const applyTriage = async () => {
    const { message, result } = triage!;
    try {
      await api.put(`/api/correspondence/${message.id}`, {
        response_required: result.response_required ? 1 : 0,
        response_due: result.response_required ? addDaysIso(message.date || todayIso(), result.response_days || 15) : null,
        status: message.status === 'à traiter' ? 'en cours' : message.status,
      });
      toast('Échange qualifié');
      triage!.close();
      setTriage(null);
      setRefreshKey((k) => k + 1);
      onChange();
    } catch (e) {
      toastError(e);
    }
  };

  const createEw = async () => {
    const { message, result } = triage!;
    const ew = await api.post('/api/early_warnings', { contract_id: contractId, title: message.subject, description: `${result.summary}\n\n${result.risk_reason}`, date_notified: todayIso(), status: 'ouvert' });
    triage!.close();
    setTriage(null);
    toast(`${ew.number} créé : complétez-le et notifiez-le`);
    onGoTab('ew', ew.id);
  };

  return (
    <>
      <RegisterPanel
        table="correspondence"
        contractId={contractId}
        title="Registre des échanges"
        addLabel="Saisir un échange"
        emptyText="Aucun échange. Glissez des emails (.eml, .msg) ou des courriers (PDF) dans la zone ci-dessus."
        fields={CORRESPONDENCE_FIELDS}
        defaults={{ direction: 'entrant', date: todayIso(), status: 'à traiter', type: 'Courrier' }}
        docLink="correspondence_id"
        docCategory="Échange"
        openId={openId}
        refreshKey={refreshKey}
        onChange={onChange}
        formFooter={(m, close) => (
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                const result = await api.post('/api/ai/triage', { correspondence_id: m.id });
                setTriage({ message: m, result, close });
              } catch (e) {
                toastError(e);
              }
            }}
          >
            <Sparkles size={16} /> Analyser avec l’IA
          </button>
        )}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <select className="input w-auto" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="entrant">Échanges reçus</option>
              <option value="sortant">Échanges envoyés</option>
            </select>
            <div className="min-w-[260px] flex-1">
              <FileDrop compact onFiles={importFiles} label={busy ? 'Import en cours…' : 'Déposez ici emails Outlook (.msg), .eml ou PDF : objet, expéditeur, date et pièces jointes sont lus automatiquement'} />
            </div>
          </div>
        }
        columns={[
          { key: 'reference', label: 'Réf.', className: 'whitespace-nowrap font-medium' },
          { key: 'date', label: 'Date', render: dateCell('date'), className: 'whitespace-nowrap' },
          {
            key: 'direction',
            label: '',
            render: (r) => (r.direction === 'sortant' ? <ArrowUpRight size={16} className="text-indigo-600" aria-label="Envoyé" /> : <ArrowDownLeft size={16} className="text-emerald-600" aria-label="Reçu" />),
          },
          {
            key: 'subject',
            label: 'Objet',
            render: (r) => (
              <>
                {r.subject}
                <div className="text-xs text-slate-400">
                  {r.type}
                  {r.documents_count > 0 && ` · ${r.documents_count} fichier(s)`}
                </div>
              </>
            ),
          },
          { key: 'party', label: 'De / À', render: (r) => <span className="text-xs">{r.direction === 'sortant' ? r.recipient : r.sender}</span> },
          { key: 'response_due', label: 'Réponse avant', render: (r) => (r.response_required && !r.response_date ? <DueCell date={r.response_due} /> : r.response_date ? `répondu ${fmtDate(r.response_date)}` : '—'), className: 'whitespace-nowrap' },
          { key: 'status', label: 'Statut', render: statusCell },
        ]}
      />
      {triage && (
        <Modal title={`Analyse IA : ${triage.message.subject}`} onClose={() => setTriage(null)}>
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-line">{triage.result.summary}</p>
            <p>
              Réponse attendue : <b>{triage.result.response_required ? `oui, sous ${triage.result.response_days} jour(s)` : 'non'}</b>
            </p>
            {triage.result.actions?.length > 0 && (
              <ul className="list-disc pl-5">
                {triage.result.actions.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
            {triage.result.risk !== 'aucun' && (
              <p className="rounded bg-amber-50 p-2 text-amber-900">
                Risque détecté : <b>{triage.result.risk.replace('_', ' ')}</b> — {triage.result.risk_reason}
              </p>
            )}
            <p className="text-xs text-slate-400">Analyse générée par {triage.result.provider === 'claude' ? 'Claude' : 'l’IA locale'} : à valider.</p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
              {isNec(contract) && ['early_warning', 'compensation_event'].includes(triage.result.risk) && (
                <button className="btn-secondary" onClick={() => createEw().catch(toastError)}>
                  Créer un Early Warning
                </button>
              )}
              <button className="btn-primary" onClick={applyTriage}>
                Appliquer (réponse attendue, statut)
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function JournalTab({ contractId }: { contractId: number }) {
  const [rows, setRows] = useState<Rec[]>([]);
  useEffect(() => {
    api.get(`/api/journal?contract_id=${contractId}`).then(setRows).catch(toastError);
  }, [contractId]);
  return (
    <div className="card p-4">
      <ul className="divide-y divide-slate-100 text-sm">
        {rows.map((j) => (
          <li key={j.id} className="flex gap-3 py-1.5">
            <span className="w-32 shrink-0 text-xs text-slate-400">{fmtDateTime(j.at)}</span>
            <span className="w-40 shrink-0 text-slate-500">{ENTITY_LABELS[j.entity] ?? j.entity}</span>
            <span className="w-28 shrink-0">{j.action}</span>
            <span className="min-w-0">{j.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
