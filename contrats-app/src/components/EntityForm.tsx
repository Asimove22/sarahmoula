import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { api, type Rec } from '../api';
import type { Field, Option } from '../schemas';

const optValue = (o: Option) => (typeof o === 'string' ? o : o.value);
const optLabel = (o: Option) => (typeof o === 'string' ? o : o.label);

/** Charge les EW / CE du contrat pour les champs de type « ref ». */
function useRefOptions(fields: Field[], contractId?: number) {
  const [options, setOptions] = useState<Record<string, Rec[]>>({});
  const refs = [...new Set(fields.filter((f) => f.ref).map((f) => f.ref!))].join(',');
  useEffect(() => {
    if (!contractId || !refs) return;
    Promise.all(refs.split(',').map((r) => api.get(`/api/${r}?contract_id=${contractId}`).then((rows) => [r, rows] as const)))
      .then((entries) => setOptions(Object.fromEntries(entries)))
      .catch(() => {});
  }, [refs, contractId]);
  return options;
}

export function EntityForm({
  fields,
  initial,
  contractId,
  onSubmit,
  onCancel,
  submitLabel = 'Enregistrer',
  footer,
}: {
  fields: Field[];
  initial: Rec;
  contractId?: number;
  onSubmit: (values: Rec) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
  footer?: ReactNode;
}) {
  const [values, setValues] = useState<Rec>(initial);
  const [saving, setSaving] = useState(false);
  const refOptions = useRefOptions(fields, contractId);
  const set = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // On n'envoie que les champs du formulaire, les champs masqués sont conservés tels quels.
      const payload: Rec = {};
      for (const f of fields) payload[f.name] = values[f.name] ?? null;
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  const visible = fields.filter((f) => !f.showIf || f.showIf(values));
  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {visible.map((f) => (
          <Fragment key={f.name}>
          {f.section && <div className="mt-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 sm:col-span-2">{f.section}</div>}
          <div className={f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            {f.type === 'checkbox' ? (
              <label className="flex items-center gap-2 pt-5 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked ? 1 : 0)} />
                {f.label}
              </label>
            ) : (
              <label className="block">
                <span className="label">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </span>
                {f.type === 'textarea' ? (
                  <textarea className="input min-h-[84px]" value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                ) : f.type === 'select' ? (
                  <select className="input" value={values[f.name] ?? ''} required={f.required} onChange={(e) => set(f.name, e.target.value)}>
                    <option value="">—</option>
                    {f.options!.map((o) => (
                      <option key={optValue(o)} value={optValue(o)}>
                        {optLabel(o)}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'ref' ? (
                  <select className="input" value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>
                    {(refOptions[f.ref!] ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.number} – {r.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    step={f.type === 'number' ? 'any' : undefined}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={values[f.name] ?? ''}
                    onChange={(e) => set(f.name, f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                  />
                )}
                {f.help && <span className="mt-0.5 block text-xs text-slate-400">{f.help}</span>}
              </label>
            )}
          </div>
          </Fragment>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <div>{footer}</div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
