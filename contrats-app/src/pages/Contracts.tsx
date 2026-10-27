import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { api, type Rec } from '../api';
import { EntityForm } from '../components/EntityForm';
import { Badge, Empty, Modal, toast, toastError } from '../components/ui';
import { CONTRACT_FIELDS, CONTRACT_STATUSES, frameworkLabel } from '../schemas';
import { fmtDate, fmtMoney } from '../format';

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
        <h1 className="mr-auto text-xl font-semibold">Contrats</h1>
        <a className="btn-secondary" href="/api/export/contracts.csv">
          <FileSpreadsheet size={16} /> Excel
        </a>
        <button className="btn-primary" onClick={() => setParams({ nouveau: '1' })}>
          <Plus size={16} /> Nouveau contrat
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Rechercher un contrat…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="en_cours">En cours</option>
          <option value="">Tous</option>
          {CONTRACT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <Empty>{rows.length ? 'Aucun contrat ne correspond au filtre.' : 'Aucun contrat pour le moment : créez le premier.'}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Contrat</th>
                <th className="th">Cadre</th>
                <th className="th">Cocontractant</th>
                <th className="th">Montant</th>
                <th className="th">Fin</th>
                <th className="th">Suivi</th>
                <th className="th">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-indigo-50/40" onClick={() => navigate(`/contrats/${c.id}`)}>
                  <td className="td">
                    <Link to={`/contrats/${c.id}`} className="font-medium text-indigo-700 hover:underline">
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
                    {c.documents_count} doc.
                    {c.open_ew_count > 0 && <span className="ml-2 text-amber-700">{c.open_ew_count} EW</span>}
                    {c.open_ce_count > 0 && <span className="ml-2 text-indigo-700">{c.open_ce_count} CE</span>}
                    {c.pending_replies_count > 0 && <span className="ml-2 text-red-600">{c.pending_replies_count} rép.</span>}
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

      {creating && (
        <Modal title="Nouveau contrat" onClose={() => setParams({})}>
          <EntityForm
            fields={CONTRACT_FIELDS}
            initial={{ framework: 'NEC4', status: 'actif', currency: 'EUR', ce_notify_weeks: 8, pm_reply_weeks: 1, quote_weeks: 3, pm_quote_reply_weeks: 2, pm_programme_reply_weeks: 2, visa_days: 15 }}
            submitLabel="Créer le contrat"
            onCancel={() => setParams({})}
            onSubmit={async (values) => {
              try {
                const created = await api.post('/api/contracts', values);
                toast('Contrat créé. Déposez maintenant le contrat signé et ses annexes.');
                navigate(`/contrats/${created.id}?tab=documents`);
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
