import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarPlus, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { api, type Rec } from '../api';
import { DocumentsPanel } from '../components/DocumentsPanel';
import { DeadlineList } from '../components/DeadlineList';
import { EntityForm } from '../components/EntityForm';
import { RegisterPanel } from '../components/RegisterPanel';
import { Timeline } from '../components/Timeline';
import { Badge, FileDrop, Modal, toast, toastError } from '../components/ui';
import { CE_FIELDS, CONTRACT_FIELDS, CORRESPONDENCE_FIELDS, ENTITY_LABELS, EW_FIELDS, MILESTONE_FIELDS, frameworkLabel, isNec } from '../schemas';
import { daysFromToday, fmtDate, fmtDateTime, fmtMoney, relativeDays, todayIso } from '../format';

const TABS = [
  { id: 'synthese', label: 'Synthèse' },
  { id: 'documents', label: 'Documents' },
  { id: 'ew', label: 'Early Warnings', nec: true },
  { id: 'ce', label: 'Compensation Events', nec: true },
  { id: 'echanges', label: 'Échanges' },
  { id: 'planning', label: 'Planning' },
  { id: 'journal', label: 'Historique' },
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
  const [editing, setEditing] = useState(false);
  const tab = params.get('tab') ?? 'synthese';
  const openId = params.get('open') ? Number(params.get('open')) : undefined;

  const load = useCallback(() => {
    api.get<Rec>(`/api/contracts/${id}`).then(setContract).catch(toastError);
    api.get(`/api/deadlines?contract_id=${id}`).then(setDeadlines).catch(toastError);
  }, [id]);
  useEffect(load, [load]);

  if (!contract) return <div className="text-sm text-slate-500">Chargement…</div>;
  const nec = isNec(contract);
  const tabs = TABS.filter((t) => !t.nec || nec);
  const goTab = (t: string, open?: number) => setParams(open ? { tab: t, open: String(open) } : { tab: t });

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
          </button>
        ))}
      </nav>

      {tab === 'synthese' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card p-4 lg:col-span-2">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
              <Info label="Mon rôle">{contract.my_role}</Info>
              <Info label="Cocontractant">{contract.counterparty}</Info>
              <Info label="Projet">{contract.project}</Info>
              <Info label="Montant HT">{fmtMoney(contract.amount, contract.currency)}</Info>
              <Info label="Signature">{fmtDate(contract.signature_date)}</Info>
              <Info label="Démarrage">{fmtDate(contract.start_date)}</Info>
              <Info label="Achèvement">{fmtDate(contract.completion_date)}</Info>
              <Info label="Fin / échéance">{fmtDate(contract.end_date)}</Info>
              <Info label="Préavis">
                {contract.notice_period_days ? `${contract.notice_period_days} j${contract.tacit_renewal ? ' · reconduction tacite' : ''}` : contract.tacit_renewal ? 'Reconduction tacite' : '—'}
              </Info>
              <Info label="Project Manager / MOE">{contract.project_manager}</Info>
              <Info label="Supervisor / contrôle">{contract.supervisor}</Info>
              {nec && (
                <Info label="Délais NEC (sem.)">
                  notif. CE {contract.ce_notify_weeks} · rép. PM {contract.pm_reply_weeks} · devis {contract.quote_weeks} · rép. devis {contract.pm_quote_reply_weeks}
                </Info>
              )}
            </dl>
            {contract.contacts && <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-3 text-sm">{contract.contacts}</p>}
            {contract.notes && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{contract.notes}</p>}
          </section>
          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Échéances du contrat</h2>
            <DeadlineList items={deadlines} showContract={false} empty="Aucune échéance ouverte." />
          </section>
        </div>
      )}

      {tab === 'documents' && <DocumentsPanel contractId={id} defaultCategory="Contrat" />}

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
          openId={tab === 'ew' ? openId : undefined}
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
                Convertir en Compensation Event →
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
          openId={tab === 'ce' ? openId : undefined}
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

      {tab === 'echanges' && <CorrespondenceTab contractId={id} openId={openId} onChange={load} />}
      {tab === 'planning' && <PlanningTab contract={contract} openId={openId} onChange={load} />}
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
    </div>
  );
}

function CorrespondenceTab({ contractId, openId, onChange }: { contractId: number; openId?: number; onChange: () => void }) {
  const [direction, setDirection] = useState('entrant');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);

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

  return (
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
  );
}

function PlanningTab({ contract, openId, onChange }: { contract: Rec; openId?: number; onChange: () => void }) {
  const [milestones, setMilestones] = useState<Rec[]>([]);
  const load = useCallback(() => {
    api.get(`/api/milestones?contract_id=${contract.id}`).then(setMilestones).catch(toastError);
  }, [contract.id]);
  useEffect(load, [load]);
  return (
    <div className="space-y-4">
      <Timeline milestones={milestones} contract={contract} />
      <RegisterPanel
        table="milestones"
        contractId={contract.id}
        title="Jalons et échéances du planning"
        addLabel="Ajouter un jalon"
        emptyText="Aucun jalon. Ajoutez les Key Dates, la Completion Date, les soumissions de programme, les réunions…"
        fields={MILESTONE_FIELDS}
        defaults={{ status: 'à venir', type: 'Jalon' }}
        openId={openId}
        onChange={() => {
          load();
          onChange();
        }}
        columns={[
          { key: 'title', label: 'Jalon', className: 'font-medium' },
          { key: 'type', label: 'Type' },
          { key: 'planned_date', label: 'Prévu', render: dateCell('planned_date'), className: 'whitespace-nowrap' },
          { key: 'forecast_date', label: 'Prévision', render: (r) => (r.actual_date ? '—' : <DueCell date={r.forecast_date || r.planned_date} />), className: 'whitespace-nowrap' },
          { key: 'actual_date', label: 'Réel', render: dateCell('actual_date'), className: 'whitespace-nowrap' },
          {
            key: 'slip',
            label: 'Écart',
            render: (r) => {
              const end = r.actual_date || r.forecast_date;
              if (!r.planned_date || !end) return '—';
              const n = daysFromToday(end) - daysFromToday(r.planned_date);
              return <span className={n > 0 ? 'text-red-600' : 'text-emerald-700'}>{n > 0 ? `+${n} j` : `${n} j`}</span>;
            },
          },
          { key: 'status', label: 'Statut', render: statusCell },
        ]}
      />
    </div>
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
            <span className="w-36 shrink-0 text-slate-500">{ENTITY_LABELS[j.entity]}</span>
            <span className="w-28 shrink-0">{j.action}</span>
            <span className="min-w-0">{j.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
