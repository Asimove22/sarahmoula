import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitCompare, Network, Trash2, Upload } from 'lucide-react';
import { api, type Rec } from '../../api';
import { RegisterPanel } from '../../components/RegisterPanel';
import { Timeline } from '../../components/Timeline';
import { Badge, Empty, Modal, SubTabs, toast, toastError } from '../../components/ui';
import { MILESTONE_FIELDS, PROGRAMME_FIELDS, WBS_FIELDS, isNec } from '../../schemas';
import { daysFromToday, fmtDate, fmtDateTime, fmtMoney, relativeDays, todayIso } from '../../format';
import { t } from '../../i18n';

const dateCell = (key: string) => (r: Rec) => fmtDate(r[key]);
const statusCell = (r: Rec) => <Badge value={r.status} />;
const daysBetween = (a?: string | null, b?: string | null) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) : null);

function DueCell({ date }: { date?: string | null }) {
  if (!date) return <>—</>;
  const n = daysFromToday(date);
  return (
    <span className={n < 0 ? 'font-medium text-red-600' : n <= 7 ? 'font-medium text-amber-700' : ''}>
      {fmtDate(date)} <span className="text-xs">({relativeDays(date)})</span>
    </span>
  );
}

export function PlanningTab({ contract, openId, entity, onChange }: { contract: Rec; openId?: number; entity?: string; onChange: () => void }) {
  const nec = isNec(contract);
  const [sub, setSub] = useState(entity === 'programmes' ? 'programmes' : entity === 'wbs_items' ? 'wbs' : entity === 'schedule_imports' ? 'plannings' : 'jalons');
  return (
    <div className="space-y-4">
      <SubTabs
        value={sub}
        onChange={setSub}
        tabs={[
          { id: 'jalons', label: 'Jalons' },
          { id: 'plannings', label: 'Plannings & chemin critique' },
          { id: 'wbs', label: 'WBS' },
          ...(nec ? [{ id: 'programmes', label: 'Programmes NEC (cl. 31-32)' }] : []),
        ]}
      />
      {sub === 'jalons' && <MilestonesPanel contract={contract} openId={entity === 'milestones' ? openId : undefined} onChange={onChange} />}
      {sub === 'plannings' && <SchedulesPanel contract={contract} onChange={onChange} />}
      {sub === 'wbs' && <WbsPanel contract={contract} onChange={onChange} />}
      {sub === 'programmes' && (
        <RegisterPanel
          table="programmes"
          contractId={contract.id}
          title={t('Registre des programmes')}
          addLabel="Programme soumis"
          emptyText="Enregistrez chaque programme soumis au Project Manager : sa réponse est attendue sous 2 semaines (cl. 31.3) et le prochain programme révisé selon l’intervalle du Contract Data (cl. 32.2)."
          fields={PROGRAMME_FIELDS}
          defaults={{ status: 'soumis', submitted_date: todayIso() }}
          openId={entity === 'programmes' ? openId : undefined}
          onChange={onChange}
          columns={[
            { key: 'number', label: 'N°', className: 'whitespace-nowrap font-medium' },
            { key: 'title', label: 'Programme' },
            { key: 'submitted_date', label: 'Soumis', render: dateCell('submitted_date'), className: 'whitespace-nowrap' },
            { key: 'pm_reply_due', label: 'Réponse PM attendue', render: (r) => (r.pm_response_date ? `reçue ${fmtDate(r.pm_response_date)}` : <DueCell date={r.pm_reply_due} />), className: 'whitespace-nowrap' },
            { key: 'planned_completion', label: 'Planned Completion', render: (r) => {
              const delta = daysBetween(contract.completion_date, r.planned_completion);
              return <>{fmtDate(r.planned_completion)}{delta ? <span className={`ml-1 text-xs ${delta > 0 ? 'text-red-600' : 'text-emerald-700'}`}>({delta > 0 ? '+' : ''}{delta} j)</span> : null}</>;
            }, className: 'whitespace-nowrap' },
            { key: 'status', label: 'Statut', render: statusCell },
          ]}
        />
      )}
    </div>
  );
}

function MilestonesPanel({ contract, openId, onChange }: { contract: Rec; openId?: number; onChange: () => void }) {
  const [milestones, setMilestones] = useState<Rec[]>([]);
  const load = useCallback(() => {
    api.get(`/api/milestones?contract_id=${contract.id}`).then(setMilestones).catch(toastError);
  }, [contract.id]);
  useEffect(load, [load]);
  return (
    <RegisterPanel
      table="milestones"
      contractId={contract.id}
      title={t('Jalons et échéances du planning')}
      addLabel="Ajouter un jalon"
      emptyText="Aucun jalon. Ajoutez les Key Dates, la Completion Date, les réunions… ou importez-les depuis la revue IA."
      fields={MILESTONE_FIELDS}
      defaults={{ status: 'à venir', type: 'Jalon' }}
      openId={openId}
      onChange={() => {
        load();
        onChange();
      }}
      topContent={<Timeline milestones={milestones} contract={contract} />}
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
            const n = daysBetween(r.planned_date, r.actual_date || r.forecast_date);
            if (n === null) return '—';
            return <span className={n > 0 ? 'text-red-600' : 'text-emerald-700'}>{n > 0 ? `+${n} j` : `${n} j`}</span>;
          },
        },
        { key: 'status', label: 'Statut', render: statusCell },
      ]}
    />
  );
}

function SchedulesPanel({ contract, onChange }: { contract: Rec; onChange: () => void }) {
  const [imports, setImports] = useState<Rec[]>([]);
  const [selected, setSelected] = useState<Rec | null>(null);
  const [compare, setCompare] = useState<Rec | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const contractEnd = contract.completion_date || contract.end_date;

  const load = useCallback(() => {
    api.get(`/api/schedule_imports?contract_id=${contract.id}`).then((rows) => {
      setImports(rows);
      setSelected((s) => (s && rows.some((r) => r.id === s.id) ? s : rows[0] ?? null));
    }).catch(toastError);
  }, [contract.id]);
  useEffect(load, [load]);

  const doImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      if (name) form.append('name', name);
      const res = await fetch(`/api/contracts/${contract.id}/schedule/import`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(t('{n} tâches importées, {c} critiques', { n: data.task_count, c: data.critical_count }));
      setFile(null);
      setName('');
      load();
      setSelected(data);
      onChange();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const runCompare = async () => {
    if (imports.length < 2) return;
    try {
      setCompare(await api.get<Rec>(`/api/schedule-compare?from=${imports[1].id}&to=${imports[0].id}`));
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={doImport} className="card flex flex-wrap items-end gap-3 p-3">
        <label className="min-w-[240px] flex-1">
          <span className="label">{t('Fichier planning : MS Project (.xml), Primavera P6 (.xer), Excel (.xlsx) ou CSV')}</span>
          <input className="input" type="file" accept=".xml,.xer,.xlsx,.csv,.txt,.mpp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="w-56">
          <span className="label">{t('Nom (ex. Programme rév. 3)')}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={!file || busy}>
          <Upload size={16} /> {busy ? t('Import…') : t('Importer')}
        </button>
        <p className="w-full text-xs text-slate-400">
          {t('MS Project : « Enregistrer sous → XML ». Excel/CSV : colonnes ID, Nom, Début, Fin, Prédécesseurs (ex. « 3;5FD+2j »), optionnellement Durée, WBS, %, Marge totale. Sans marge fournie, elle est calculée en jours calendaires.')}
        </p>
      </form>

      {imports.length === 0 ? (
        <Empty>{t('Aucun planning importé.')}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">{t('Planning')}</th>
                <th className="th">{t('Importé le')}</th>
                <th className="th">{t('Date d’état')}</th>
                <th className="th">{t('Fin prévue')}</th>
                <th className="th">{t('Tâches')}</th>
                <th className="th">{t('Critiques')}</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {imports.map((i) => {
                const delta = daysBetween(contractEnd, i.planned_completion);
                return (
                  <tr key={i.id} className={`cursor-pointer ${selected?.id === i.id ? 'bg-brand-50' : 'hover:bg-slate-50'}`} onClick={() => setSelected(i)}>
                    <td className="td font-medium">
                      {i.name}
                      <div className="text-xs font-normal text-slate-400">{i.format}</div>
                    </td>
                    <td className="td whitespace-nowrap">{fmtDateTime(i.created_at)}</td>
                    <td className="td">{fmtDate(i.data_date)}</td>
                    <td className="td whitespace-nowrap">
                      {fmtDate(i.planned_completion)}
                      {delta !== null && delta !== 0 && <span className={`ml-1 text-xs ${delta > 0 ? 'text-red-600' : 'text-emerald-700'}`}>({delta > 0 ? '+' : ''}{delta} {t('j / contrat)')}</span>}
                    </td>
                    <td className="td">{i.task_count}</td>
                    <td className="td text-red-600">{i.critical_count}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-ghost !p-1.5"
                          title={t('Créer la WBS à partir de ce planning')}
                          onClick={async () => {
                            const { added } = await api.post(`/api/schedule_imports/${i.id}/wbs`, {});
                            toast(added ? t('{n} élément(s) WBS créés', { n: added }) : t('Aucun nouveau code WBS'));
                          }}
                        >
                          <Network size={16} />
                        </button>
                        <button
                          className="btn-ghost !p-1.5 text-red-600"
                          title={t('Supprimer cet import')}
                          onClick={async () => {
                            if (!confirm(t('Supprimer l’import « {name} » ? (le fichier reste dans la GED)', { name: i.name }))) return;
                            await api.del(`/api/schedule_imports/${i.id}`);
                            load();
                            onChange();
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {imports.length >= 2 && (
            <div className="border-t border-slate-100 p-2">
              <button className="btn-secondary" onClick={runCompare}>
                <GitCompare size={16} /> {t('Comparer les deux derniers plannings')}
              </button>
            </div>
          )}
        </div>
      )}

      {selected && <Gantt imp={selected} contractEnd={contractEnd} />}

      {compare && (
        <Modal title={`Comparaison : ${compare.from.name} → ${compare.to.name}`} onClose={() => setCompare(null)} wide>
          <p className="mb-3 text-sm">
            {t('Fin prévue :')} {fmtDate(compare.from.planned_completion)} → <b>{fmtDate(compare.to.planned_completion)}</b>{' '}
            {compare.completion_delta_days ? (
              <span className={compare.completion_delta_days > 0 ? 'text-red-600' : 'text-emerald-700'}>
                ({compare.completion_delta_days > 0 ? '+' : ''}
                {compare.completion_delta_days} j)
              </span>
            ) : (
              '(inchangée)'
            )}
            {' · '}
            {compare.added} {t('tâche(s) ajoutée(s),')} {compare.removed} {t('supprimée(s)')}
          </p>
          {compare.changes.length === 0 ? (
            <Empty>{t('Aucune tâche commune n’a bougé.')}</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">{t('Tâche')}</th>
                  <th className="th">{t('Fin avant')}</th>
                  <th className="th">{t('Fin après')}</th>
                  <th className="th">{t('Écart')}</th>
                  <th className="th">{t('Criticité')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compare.changes.map((c: Rec, i: number) => (
                  <tr key={i}>
                    <td className="td">{c.name}</td>
                    <td className="td">{fmtDate(c.finish_before)}</td>
                    <td className="td">{fmtDate(c.finish_after)}</td>
                    <td className={`td ${c.delta_days > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{c.delta_days ? `${c.delta_days > 0 ? '+' : ''}${c.delta_days} j` : '—'}</td>
                    <td className="td text-xs">{c.is_critical !== c.was_critical ? (c.is_critical ? t('devient critique') : t('n’est plus critique')) : c.is_critical ? 'critique' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}

const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Diagramme de Gantt simplifié : barre rouge = tâche critique, trait gris = référence (baseline). */
function Gantt({ imp, contractEnd }: { imp: Rec; contractEnd?: string }) {
  const [tasks, setTasks] = useState<Rec[]>([]);
  const [onlyCritical, setOnlyCritical] = useState(true);
  useEffect(() => {
    api.get(`/api/schedule_imports/${imp.id}/tasks`).then(setTasks).catch(toastError);
  }, [imp.id]);

  const shown = useMemo(() => tasks.filter((t) => t.start && t.finish && (!onlyCritical || (t.is_critical && !t.is_summary))).slice(0, 400), [tasks, onlyCritical]);
  if (!tasks.length) return null;
  const dates = [...shown.flatMap((t) => [t.start, t.finish, t.baseline_finish].filter(Boolean)), contractEnd, todayIso()].filter(Boolean) as string[];
  const min = Math.min(...dates.map(ms));
  const max = Math.max(...dates.map(ms)) + 86400000;
  const x = (iso: string) => ((ms(iso) - min) / (max - min)) * 100;

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="mr-auto font-semibold">{imp.name}</h3>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyCritical} onChange={(e) => setOnlyCritical(e.target.checked)} /> {t('Chemin critique uniquement')}
        </label>
        <span className="text-xs text-slate-400">
          {shown.length} / {tasks.length} {t('tâches ·')} <span className="text-red-600">{t('■ critique')}</span> · <span className="text-brand-500">{t('■ non critique')}</span> {t('· ┄ référence ·')} <span className="text-red-400">{t('| aujourd’hui')}</span>
          {contractEnd && <span className="text-slate-700"> {t('· ▌ fin contractuelle')}</span>}
        </span>
      </div>
      {shown.length === 0 ? (
        <Empty>{t('Aucune tâche critique dans ce planning.')}</Empty>
      ) : (
        <div className="space-y-0.5 text-xs">
          {shown.map((task) => (
            <div key={task.id} className="flex items-center gap-2">
              <div className="w-64 shrink-0 truncate" title={`${task.wbs_code ?? ''} ${task.name}`} style={{ paddingLeft: `${Math.max((task.outline_level ?? 1) - 1, 0) * 8}px` }}>
                <span className={task.is_summary ? 'font-semibold' : ''}>{task.name}</span>
              </div>
              <div className="w-20 shrink-0 text-right tabular-nums text-slate-500" title={t('Marge totale (jours)')}>
                {task.is_summary ? '' : `${task.total_float_days ?? '—'} j`}
              </div>
              <div className="relative h-4 flex-1 rounded bg-slate-50">
                <div className="absolute bottom-0 top-0 w-px bg-red-400" style={{ left: `${x(todayIso())}%` }} />
                {contractEnd && <div className="absolute -bottom-0.5 -top-0.5 w-0.5 bg-slate-800" style={{ left: `${x(contractEnd)}%` }} />}
                {task.baseline_start && task.baseline_finish && (
                  <div className="absolute bottom-0 h-0.5 border-b border-dashed border-slate-400" style={{ left: `${x(task.baseline_start)}%`, width: `${Math.max(x(task.baseline_finish) - x(task.baseline_start), 0.3)}%` }} />
                )}
                {task.is_milestone ? (
                  <div className={`absolute top-0.5 h-3 w-3 -translate-x-1/2 rotate-45 ${task.is_critical ? 'bg-red-600' : 'bg-brand-500'}`} style={{ left: `${x(task.finish)}%` }} title={`${task.name} : ${fmtDate(task.finish)}`} />
                ) : (
                  <div
                    className={`absolute top-0.5 h-3 rounded-sm ${task.is_summary ? 'bg-slate-700' : task.is_critical ? 'bg-red-500' : 'bg-brand-400'}`}
                    style={{ left: `${x(task.start)}%`, width: `${Math.max(x(task.finish) - x(task.start) + 100 / ((max - min) / 86400000), 0.4)}%` }}
                    title={`${task.name} : ${fmtDate(task.start)} → ${fmtDate(task.finish)}${task.percent_complete != null ? ` · ${task.percent_complete} %` : ''}`}
                  >
                    {task.percent_complete ? <div className="h-full rounded-sm bg-black/25" style={{ width: `${Math.min(task.percent_complete, 100)}%` }} /> : null}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WbsPanel({ contract, onChange }: { contract: Rec; onChange: () => void }) {
  return (
    <RegisterPanel
      table="wbs_items"
      contractId={contract.id}
      title={t('Structure de découpage (WBS)')}
      addLabel="Ajouter un élément"
      emptyText="Créez la WBS à la main ou depuis un planning importé (bouton réseau dans la liste des plannings). Les codes WBS servent aussi dans la matrice RACI."
      fields={WBS_FIELDS}
      onChange={onChange}
      columns={[
        {
          key: 'code',
          label: 'Code',
          className: 'whitespace-nowrap font-mono text-xs',
          render: (r) => <span style={{ paddingLeft: `${(String(r.code).split('.').length - 1) * 14}px` }}>{r.code}</span>,
        },
        { key: 'title', label: 'Intitulé', render: (r) => <span className={String(r.code).includes('.') ? '' : 'font-semibold'}>{r.title}</span> },
        { key: 'owner', label: 'Responsable' },
        { key: 'budget', label: 'Budget', render: (r) => fmtMoney(r.budget, contract.currency), className: 'whitespace-nowrap' },
      ]}
    />
  );
}
