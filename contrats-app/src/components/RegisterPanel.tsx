import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { api, type Rec } from '../api';
import type { Field } from '../schemas';
import { EntityForm } from './EntityForm';
import { DocumentsPanel } from './DocumentsPanel';
import { Empty, Modal, toast, toastError } from './ui';

export interface Column {
  key: string;
  label: string;
  render?: (row: Rec) => ReactNode;
  className?: string;
}

/**
 * Registre générique d'un contrat (Early Warnings, CE, échanges, jalons) :
 * tableau, création / modification en fenêtre, documents rattachés, export CSV.
 */
export function RegisterPanel({
  table,
  contractId,
  title,
  fields,
  columns,
  addLabel,
  emptyText,
  defaults = {},
  docLink,
  docCategory,
  openId,
  refreshKey,
  toolbar,
  formFooter,
  rowClassName,
  onChange,
}: {
  table: string;
  contractId: number;
  title: string;
  fields: Field[];
  columns: Column[];
  addLabel: string;
  emptyText: string;
  defaults?: Rec;
  /** Colonne de documents qui pointe vers ce registre (ex. 'early_warning_id'). */
  docLink?: string;
  docCategory?: string;
  openId?: number;
  refreshKey?: number;
  toolbar?: ReactNode;
  formFooter?: (row: Rec, close: () => void) => ReactNode;
  rowClassName?: (row: Rec) => string;
  onChange?: () => void;
}) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    api.get(`/api/${table}?contract_id=${contractId}`).then(setRows).catch(toastError);
  }, [table, contractId]);
  useEffect(load, [load, refreshKey]);

  // Ouverture directe d'un élément (depuis la recherche ou l'échéancier).
  useEffect(() => {
    if (openId) api.get<Rec>(`/api/${table}/${openId}`).then(setEditing).catch(() => {});
  }, [openId, table]);

  const close = () => setEditing(null);
  const changed = () => {
    load();
    onChange?.();
  };

  const save = async (values: Rec) => {
    try {
      if (editing?.id) {
        setEditing(await api.put(`/api/${table}/${editing.id}`, values));
        toast('Modifications enregistrées');
      } else {
        const created = await api.post(`/api/${table}`, { ...values, contract_id: contractId });
        toast(`Créé : ${created.number ?? created.reference ?? created.title ?? ''}`);
        // On garde la fenêtre ouverte pour pouvoir joindre des documents.
        setEditing(docLink ? created : null);
      }
      changed();
    } catch (e) {
      toastError(e);
    }
  };

  const remove = async () => {
    if (!editing?.id || !confirm('Supprimer définitivement cet élément ?')) return;
    try {
      await api.del(`/api/${table}/${editing.id}`);
      close();
      changed();
    } catch (e) {
      toastError(e);
    }
  };

  const q = filter.toLowerCase();
  const shown = q ? rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))) : rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-base font-semibold">
          {title} <span className="text-sm font-normal text-slate-400">({rows.length})</span>
        </h3>
        {rows.length > 5 && <input className="input max-w-[200px]" placeholder="Filtrer…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
        <a className="btn-secondary" href={`/api/export/${table}.csv?contract_id=${contractId}`} title="Export CSV pour Excel">
          <FileSpreadsheet size={16} /> Excel
        </a>
        <button className="btn-primary" onClick={() => setEditing({ ...defaults })}>
          <Plus size={16} /> {addLabel}
        </button>
      </div>
      {toolbar}
      {shown.length === 0 ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`th ${c.className ?? ''}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <tr key={r.id} className={`cursor-pointer hover:bg-indigo-50/40 ${rowClassName?.(r) ?? ''}`} onClick={() => setEditing(r)}>
                  {columns.map((c) => (
                    <td key={c.key} className={`td ${c.className ?? ''}`}>
                      {c.render ? c.render(r) : (r[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? `${editing.number ?? editing.reference ?? ''} ${editing.title ?? editing.subject ?? ''}` : addLabel} onClose={close} wide={Boolean(docLink && editing.id)}>
          <EntityForm
            key={editing.id ?? 'new'}
            fields={fields}
            initial={editing}
            contractId={contractId}
            onCancel={close}
            onSubmit={save}
            submitLabel={editing.id ? 'Enregistrer' : 'Créer'}
            footer={
              editing.id ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-danger" onClick={remove}>
                    <Trash2 size={16} /> Supprimer
                  </button>
                  {formFooter?.(editing, close)}
                </div>
              ) : null
            }
          />
          {docLink && editing.id && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h4 className="mb-2 text-sm font-semibold">Documents rattachés</h4>
              <DocumentsPanel compact contractId={contractId} filter={{ [docLink]: editing.id }} defaultCategory={docCategory} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
