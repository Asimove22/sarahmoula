import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, type Rec } from '../../api';
import { RegisterPanel } from '../../components/RegisterPanel';
import { ImportExportButtons } from '../../components/ImportModal';
import { Badge, Empty, SubTabs, toastError } from '../../components/ui';
import { COMMUNICATION_FIELDS, GROUP_MEMBER_FIELDS, STAKEHOLDER_FIELDS } from '../../schemas';
import { fmtMoney } from '../../format';
import { t } from '../../i18n';

export function OrganisationTab({ contract, openId, onChange }: { contract: Rec; openId?: number; onChange: () => void }) {
  const [sub, setSub] = useState('intervenants');
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => {
    setRefreshKey((k) => k + 1);
    onChange();
  };
  return (
    <div className="space-y-4">
      <SubTabs
        value={sub}
        onChange={setSub}
        tabs={[
          { id: 'intervenants', label: 'Intervenants' },
          { id: 'groupement', label: 'Groupement' },
          { id: 'raci', label: 'Matrice RACI' },
          { id: 'communication', label: 'Matrice de communication' },
        ]}
      />
      {sub === 'intervenants' && (
        <RegisterPanel
          table="stakeholders"
          contractId={contract.id}
          title={t('Intervenants')}
          addLabel="Ajouter un intervenant"
          emptyText="Renseignez le Client, le Project Manager / MOE, le Supervisor, l’OPC, le BCT, les sous-traitants…"
          fields={STAKEHOLDER_FIELDS}
          openId={openId}
          onChange={onChange}
          columns={[
            { key: 'name', label: 'Nom', className: 'font-medium' },
            { key: 'organisation', label: 'Organisme' },
            { key: 'role', label: 'Rôle' },
            { key: 'email', label: 'Email', render: (r) => (r.email ? <a className="text-brand-700" href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()}>{r.email}</a> : '—') },
            { key: 'phone', label: 'Téléphone', className: 'whitespace-nowrap' },
          ]}
        />
      )}
      {sub === 'groupement' && <GroupPanel contract={contract} onChange={onChange} />}
      {sub === 'raci' && <RaciMatrix key={refreshKey} contractId={contract.id} onImported={refresh} />}
      {sub === 'communication' && (
        <RegisterPanel
          table="communication_rules"
          contractId={contract.id}
          title={t('Matrice de communication')}
          addLabel="Ajouter une règle"
          emptyText="Qui envoie quoi, à qui, par quel canal et dans quel délai. Le « type » sert à proposer le destinataire des courriers générés."
          fields={COMMUNICATION_FIELDS}
          onChange={onChange}
          refreshKey={refreshKey}
          toolbar={
            <div className="flex flex-wrap gap-2">
              <ImportExportButtons contractId={contract.id} kind="communication" onImported={refresh} />
            </div>
          }
          columns={[
            { key: 'subject', label: 'Information', className: 'font-medium' },
            { key: 'info_type', label: 'Type' },
            { key: 'sender', label: 'Émetteur' },
            { key: 'recipients', label: 'Destinataires' },
            { key: 'cc', label: 'Copie' },
            { key: 'channel', label: 'Canal' },
            { key: 'frequency', label: 'Fréquence / délai', render: (r) => [r.frequency, r.delay_days ? `${r.delay_days} j` : null].filter(Boolean).join(' · ') || '—' },
            { key: 'clause', label: 'Clause' },
          ]}
        />
      )}
    </div>
  );
}

function GroupPanel({ contract, onChange }: { contract: Rec; onChange: () => void }) {
  const [members, setMembers] = useState<Rec[]>([]);
  const load = useCallback(() => {
    api.get(`/api/group_members?contract_id=${contract.id}`).then(setMembers).catch(toastError);
  }, [contract.id]);
  useEffect(load, [load]);
  const total = members.reduce((n, m) => n + (m.share_percent ?? 0), 0);
  const ok = Math.abs(total - 100) < 0.01;
  return (
    <RegisterPanel
      table="group_members"
      contractId={contract.id}
      title={`${t('Groupement')} ${contract.group_type ? t(contract.group_type) : t('(type non renseigné dans la fiche contrat)')}`}
      addLabel="Ajouter un membre"
      emptyText="Saisissez le mandataire et les cotraitants avec leurs quotes-parts, conformément à la convention de groupement (à archiver dans la GED)."
      fields={GROUP_MEMBER_FIELDS}
      defaults={{ role: members.length ? 'cotraitant' : 'mandataire' }}
      onChange={() => {
        load();
        onChange();
      }}
      topContent={
        members.length > 0 && (
          <div className={`rounded-md p-3 text-sm ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {t('Total des quotes-parts :')} <b>{total.toFixed(2)} %</b> {ok ? '✓' : t('— la somme doit faire 100 %')}
            {!members.some((m) => m.role === 'mandataire') && ' · aucun mandataire désigné'}
            <div className="mt-2 flex h-3 overflow-hidden rounded bg-white">
              {members.map((m, i) => (
                <div key={m.id} title={`${m.company} : ${m.share_percent ?? 0} %`} style={{ width: `${Math.min(m.share_percent ?? 0, 100)}%` }} className={['bg-brand-500', 'bg-sky-400', 'bg-emerald-400', 'bg-amber-400', 'bg-violet-400'][i % 5]} />
              ))}
            </div>
          </div>
        )
      }
      columns={[
        { key: 'company', label: 'Entreprise', className: 'font-medium' },
        { key: 'role', label: 'Rôle', render: (r) => <Badge value={r.role} /> },
        { key: 'share_percent', label: 'Quote-part', render: (r) => (r.share_percent != null ? `${r.share_percent} %` : '—') },
        { key: 'amount', label: 'Montant', render: (r) => fmtMoney(r.amount ?? (contract.amount && r.share_percent ? (contract.amount * r.share_percent) / 100 : null), contract.currency), className: 'whitespace-nowrap' },
        { key: 'scope', label: 'Prestations', render: (r) => <span className="line-clamp-2 text-xs">{r.scope ?? '—'}</span> },
        { key: 'contact', label: 'Contact' },
      ]}
    />
  );
}

const LETTERS = ['', 'R', 'A', 'C', 'I', 'R/A'];
const CELL_COLORS: Record<string, string> = {
  R: 'bg-brand-600 text-white',
  A: 'bg-red-600 text-white',
  'R/A': 'bg-violet-600 text-white',
  C: 'bg-amber-300 text-amber-950',
  I: 'bg-sky-200 text-sky-900',
};

/** Matrice RACI éditable : un clic fait défiler R → A → C → I → R/A → vide. */
function RaciMatrix({ contractId, onImported }: { contractId: number; onImported: () => void }) {
  const [people, setPeople] = useState<Rec[]>([]);
  const [rows, setRows] = useState<Rec[]>([]);
  const [activity, setActivity] = useState('');
  const [wbs, setWbs] = useState('');

  const load = useCallback(() => {
    api.get(`/api/stakeholders?contract_id=${contractId}`).then(setPeople).catch(toastError);
    api.get(`/api/raci_items?contract_id=${contractId}`).then(setRows).catch(toastError);
  }, [contractId]);
  useEffect(load, [load]);

  const parse = (r: Rec): Record<string, string> => {
    try {
      return JSON.parse(r.assignments || '{}');
    } catch {
      return {};
    }
  };

  const cycle = async (row: Rec, personId: number) => {
    const a = parse(row);
    const next = LETTERS[(LETTERS.indexOf(a[personId] ?? '') + 1) % LETTERS.length];
    if (next) a[personId] = next;
    else delete a[personId];
    const saved = await api.put(`/api/raci_items/${row.id}`, { assignments: JSON.stringify(a) }).catch(toastError);
    if (saved) setRows((rs) => rs.map((r) => (r.id === row.id ? saved : r)));
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity.trim()) return;
    await api.post('/api/raci_items', { contract_id: contractId, activity, wbs_code: wbs || null }).catch(toastError);
    setActivity('');
    setWbs('');
    load();
  };

  const tools = (
    <div className="flex flex-wrap gap-2">
      <ImportExportButtons contractId={contractId} kind="raci" onImported={onImported} />
    </div>
  );
  if (!people.length)
    return (
      <div className="space-y-3">
        {tools}
        <Empty>{t('Ajoutez les intervenants (onglet Intervenants) ou importez directement votre matrice RACI Excel : ses colonnes créeront les intervenants.')}</Empty>
      </div>
    );
  return (
    <div className="space-y-3">
      {tools}
      <p className="text-xs text-slate-500">
        <b>R</b> {t('réalise ·')} <b>A</b> {t('approuve (un seul par activité) ·')} <b>C</b> {t('consulté ·')} <b>I</b> {t('informé. Cliquez sur une case pour changer la lettre.')}
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th min-w-[220px]">{t('Activité / livrable')}</th>
              {people.map((p) => (
                <th key={p.id} className="th text-center normal-case" title={p.role}>
                  {p.name}
                  <div className="text-[10px] font-normal text-slate-400">{p.organisation}</div>
                </th>
              ))}
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const a = parse(r);
              const approvers = Object.values(a).filter((v) => v.includes('A')).length;
              return (
                <tr key={r.id}>
                  <td className="td">
                    {r.wbs_code && <span className="mr-1 text-xs text-slate-400">{r.wbs_code}</span>}
                    {r.activity}
                    {approvers !== 1 && <div className="text-xs text-red-600">{approvers === 0 ? t('Aucun approbateur (A)') : t('Plusieurs approbateurs (A)')}</div>}
                  </td>
                  {people.map((p) => (
                    <td key={p.id} className="td text-center">
                      <button onClick={() => cycle(r, p.id)} className={`h-8 w-10 rounded text-xs font-bold ${CELL_COLORS[a[p.id]] ?? 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}>
                        {a[p.id] || '·'}
                      </button>
                    </td>
                  ))}
                  <td className="td">
                    <button
                      className="btn-ghost !p-1 text-red-600"
                      title={t('Supprimer l’activité')}
                      onClick={async () => {
                        if (!confirm(`Supprimer « ${r.activity} » ?`)) return;
                        await api.del(`/api/raci_items/${r.id}`).catch(toastError);
                        load();
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input className="input w-28" placeholder={t('Code WBS')} value={wbs} onChange={(e) => setWbs(e.target.value)} />
        <input className="input max-w-md flex-1" placeholder={t('Nouvelle activité (ex. Notifier les Early Warnings, Viser les plans EXE…)')} value={activity} onChange={(e) => setActivity(e.target.value)} />
        <button className="btn-primary">
          <Plus size={16} /> {t('Ajouter')}
        </button>
      </form>
    </div>
  );
}
