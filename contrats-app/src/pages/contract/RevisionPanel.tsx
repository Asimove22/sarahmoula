import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { api, type Rec } from '../../api';
import { Badge, Empty, FileDrop, toast, toastError } from '../../components/ui';
import { fmtDate, fmtMoney, fmtMonth, fmtNumber } from '../../format';
import { t } from '../../i18n';

type Term = { index: string; weight: string };

const STATUS_TONE: Record<string, string> = {
  définitive: 'bg-emerald-100 text-emerald-800',
  provisoire: 'bg-amber-100 text-amber-800',
};

/** Révision des prix : formule du contrat, coefficient et montant par situation, indices (INSEE ou saisis). */
export function RevisionPanel({ contract, refreshKey, onChange }: { contract: Rec; refreshKey: number; onChange: () => void }) {
  const [summary, setSummary] = useState<Rec | null>(null);
  const [catalog, setCatalog] = useState<Rec[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<Rec>(`/api/contracts/${contract.id}/revision`).then(setSummary).catch(toastError);
    api.get<Rec[]>('/api/indices').then(setCatalog).catch(toastError);
  }, [contract.id]);
  useEffect(load, [load, refreshKey]);

  const refresh = async () => {
    setBusy(true);
    try {
      const out = await api.post<Rec>('/api/indices/refresh', {});
      setCatalog(out.catalog);
      const errors = out.result.filter((r: Rec) => r.error);
      const added = out.result.reduce((n: number, r: Rec) => n + (r.added?.length ?? 0), 0);
      if (errors.length) toast(`${t('INSEE')} : ${errors.map((e: Rec) => `${e.code} – ${e.error}`).join(' · ')}`, 'error');
      else toast(t('Indices à jour : {n} nouvelle(s) valeur(s)', { n: added }));
      load();
      onChange();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!summary) return null;
  return (
    <div className="space-y-4">
      <FormulaCard contract={contract} summary={summary} catalog={catalog} onSaved={() => { load(); onChange(); }} />
      {summary.enabled && <ResultsCard contract={contract} summary={summary} />}
      <IndicesCard catalog={catalog} busy={busy} onRefresh={refresh} onChanged={() => { load(); onChange(); }} />
    </div>
  );
}

function FormulaCard({ contract, summary, catalog, onSaved }: { contract: Rec; summary: Rec; catalog: Rec[]; onSaved: () => void }) {
  const f = summary.formula;
  const [enabled, setEnabled] = useState<boolean>(summary.enabled);
  const [fixed, setFixed] = useState<string>(f.fixed != null ? String(f.fixed) : '0.15');
  const [terms, setTerms] = useState<Term[]>(f.terms.length ? f.terms.map((x: Rec) => ({ index: x.index, weight: String(x.weight) })) : [{ index: 'BT01', weight: '0.85' }]);
  const [base, setBase] = useState<string>(f.base_month ?? '');
  const [lag, setLag] = useState<string>(String(f.lag_months ?? 0));
  const [decimals, setDecimals] = useState<string>(String(f.decimals ?? 4));
  const [rounding, setRounding] = useState<string>(f.rounding ?? 'arrondi');
  const num = (s: string) => Number(String(s).replace(',', '.'));
  const sum = num(fixed || '0') + terms.reduce((s, x) => s + (num(x.weight) || 0), 0);
  const sumOk = Math.abs(sum - 1) < 0.0005;

  const save = async () => {
    try {
      await api.put(`/api/contracts/${contract.id}`, {
        rev_enabled: enabled ? 1 : 0,
        rev_fixed: num(fixed || '0'),
        rev_terms: JSON.stringify(terms.filter((x) => x.index.trim()).map((x) => ({ index: x.index.trim().toUpperCase(), weight: num(x.weight) }))),
        rev_base_month: base || null,
        rev_lag_months: Number(lag) || 0,
        rev_decimals: Number(decimals) || 4,
        rev_rounding: rounding,
      });
      toast(t('Formule de révision enregistrée'));
      onSaved();
    } catch (e) {
      toastError(e);
    }
  };

  const formula = `Cn = ${fixed || '0'}${terms.filter((x) => x.index).map((x) => ` + ${x.weight || '?'} × ${x.index}(n) / ${x.index}(0)`).join('')}`;
  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="mr-auto text-base font-semibold">{t('Formule de révision des prix')}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> {t('Révision activée pour ce contrat')}
        </label>
      </div>
      {contract.price_revision && (
        <p className="rounded bg-slate-50 p-2 text-xs text-slate-600">
          {t('Clause saisie dans la fiche')} : {contract.price_revision}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <label className="block">
          <span className="label">{t('Partie fixe (a)')}</span>
          <input className="input" value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="0.15" />
        </label>
        <div>
          <span className="label">{t('Indices et pondérations (b)')}</span>
          <div className="space-y-2">
            {terms.map((x, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input w-36" list="index-codes" value={x.index} onChange={(e) => setTerms(terms.map((y, j) => (j === i ? { ...y, index: e.target.value.toUpperCase() } : y)))} placeholder="BT01" />
                <span className="text-slate-400">×</span>
                <input className="input w-28" value={x.weight} onChange={(e) => setTerms(terms.map((y, j) => (j === i ? { ...y, weight: e.target.value } : y)))} placeholder="0.85" />
                <button className="btn-ghost !p-1" onClick={() => setTerms(terms.filter((_, j) => j !== i))} aria-label={t('Supprimer')}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <datalist id="index-codes">{catalog.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</datalist>
            <button className="btn-ghost !px-0 text-sm" onClick={() => setTerms([...terms, { index: '', weight: '' }])}>
              <Plus size={15} /> {t('Ajouter un indice')}
            </button>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="label">{t('Mois zéro (M0)')}</span>
          <input className="input" type="month" value={base} onChange={(e) => setBase(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">{t('Décalage (mois)')}</span>
          <input className="input" type="number" min={0} value={lag} onChange={(e) => setLag(e.target.value)} />
          <span className="mt-0.5 block text-xs text-slate-400">{t('Indice du mois n − décalage (ex. 3 si le CCAP retient l’indice de 3 mois plus tôt).')}</span>
        </label>
        <label className="block">
          <span className="label">{t('Décimales de Cn')}</span>
          <input className="input" type="number" min={0} max={6} value={decimals} onChange={(e) => setDecimals(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">{t('Arrondi')}</span>
          <select className="input" value={rounding} onChange={(e) => setRounding(e.target.value)}>
            <option value="arrondi">{t('au plus proche')}</option>
            <option value="supérieur">{t('au supérieur')}</option>
            <option value="troncature">{t('troncature')}</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded bg-slate-50 p-2 font-mono text-xs text-slate-700">
        <span className="mr-auto">{formula}</span>
        <span className={sumOk ? 'text-emerald-700' : 'font-semibold text-red-700'}>
          {t('Somme des coefficients')} = {fmtNumber(sum, 4)} {sumOk ? '✓' : t('(doit valoir 1)')}
        </span>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={save}>
          <Save size={16} /> {t('Enregistrer la formule')}
        </button>
      </div>
    </section>
  );
}

function ResultsCard({ contract, summary }: { contract: Rec; summary: Rec }) {
  const m = (n?: number | null) => fmtMoney(n, contract.currency);
  if (!summary.rows.length) return <Empty>{t('Aucune situation : la révision sera calculée pour chaque situation enregistrée.')}</Empty>;
  return (
    <section className="card overflow-x-auto">
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-4">
        <h3 className="mr-auto text-base font-semibold">{t('Révision par situation')}</h3>
        <span className="text-sm">
          {t('Total')} : <b className="tabular-nums">{m(summary.total)}</b>
          {summary.provisional_total !== 0 && <span className="text-xs text-amber-700"> · {t('dont provisoire {amount}', { amount: m(summary.provisional_total) })}</span>}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="th">{t('N°')}</th>
            <th className="th">{t('Mois')}</th>
            <th className="th">{t('Indices retenus')}</th>
            <th className="th text-right">Cn</th>
            <th className="th text-right">{t('Montant de base')}</th>
            <th className="th text-right">{t('Révision')}</th>
            <th className="th">{t('Statut')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {summary.rows.map((r: Rec) => {
            const rev = r.revision ?? {};
            return (
              <tr key={r.id}>
                <td className="td whitespace-nowrap font-medium">{r.number}</td>
                <td className="td whitespace-nowrap">{rev.month ? fmtMonth(rev.month) : r.period ?? fmtDate(r.submitted_date)}</td>
                <td className="td text-xs text-slate-600">
                  {rev.details
                    ? rev.details.map((d: Rec) => (
                        <div key={d.index} title={`${d.index} M0 = ${d.base_value}`}>
                          {d.index} {fmtMonth(d.value_month)} = {fmtNumber(d.value, 1)}
                          {d.substitute && <span className="text-amber-700"> ({t('dernier connu')})</span>}
                        </div>
                      ))
                    : rev.missing ?? '—'}
                </td>
                <td className="td text-right tabular-nums">{rev.coefficient != null ? fmtNumber(rev.coefficient, summary.formula.decimals) : '—'}</td>
                <td className="td whitespace-nowrap text-right tabular-nums">{m(rev.basis)}</td>
                <td className={`td whitespace-nowrap text-right font-medium tabular-nums ${rev.amount < 0 ? 'text-emerald-700' : ''}`}>{rev.amount != null ? m(rev.amount) : '—'}</td>
                <td className="td">
                  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[rev.status] ?? 'bg-red-100 text-red-800'}`}>{t(rev.status ?? '—')}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="p-3 text-xs text-slate-500">
        {t('Révision = montant de base (validé, sinon demandé) × (Cn − 1). Provisoire : calculée avec le dernier indice publié ; elle devient définitive automatiquement à la publication de l’indice du mois. Vérifiez la formule exacte dans le CCAP (assiette, mois d’établissement des prix, clause de sauvegarde).')}
      </p>
    </section>
  );
}

function IndicesCard({ catalog, busy, onRefresh, onChanged }: { catalog: Rec[]; busy: boolean; onRefresh: () => void; onChanged: () => void }) {
  const [form, setForm] = useState({ code: '', label: '', idbank: '' });
  const [entry, setEntry] = useState({ code: '', month: '', value: '' });
  const [values, setValues] = useState<{ code: string; rows: Rec[] } | null>(null);

  const addIndex = async () => {
    try {
      await api.post('/api/indices', form);
      setForm({ code: '', label: '', idbank: '' });
      toast(t('Indice ajouté'));
      onChanged();
    } catch (e) {
      toastError(e);
    }
  };
  const addValue = async () => {
    try {
      const rows = await api.post<Rec[]>(`/api/indices/${encodeURIComponent(entry.code)}/values`, { month: entry.month, value: entry.value });
      setValues({ code: entry.code.toUpperCase(), rows });
      setEntry({ ...entry, value: '' });
      toast(t('Valeur enregistrée'));
      onChanged();
    } catch (e) {
      toastError(e);
    }
  };
  const importFile = async (files: File[]) => {
    try {
      const out = await api.upload<Rec>('/api/indices/import', files.slice(0, 1));
      toast(t('{n} valeur(s) importée(s) : {codes}', { n: out.imported, codes: out.indices.join(', ') }));
      onChanged();
    } catch (e) {
      toastError(e);
    }
  };
  const show = async (code: string) => {
    if (values?.code === code) return setValues(null);
    setValues({ code, rows: await api.get<Rec[]>(`/api/indices/${encodeURIComponent(code)}/values`) });
  };

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-base font-semibold">{t('Indices de prix')}</h3>
        <button className="btn-secondary" onClick={onRefresh} disabled={busy}>
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> {busy ? t('Interrogation de l’INSEE…') : t('Mettre à jour depuis l’INSEE')}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {t('Les indices dotés d’un identifiant INSEE (idbank) sont récupérés automatiquement au démarrage de Clausia puis toutes les 6 heures, dès leur publication. L’idbank figure dans l’adresse de la série sur insee.fr (ex. BT01 : 001710986).')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">{t('Code')}</th>
              <th className="th">{t('Libellé')}</th>
              <th className="th">idbank</th>
              <th className="th">{t('Dernière valeur')}</th>
              <th className="th">{t('Mise à jour')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {catalog.map((c) => (
              <tr key={c.code} className="cursor-pointer hover:bg-brand-50/40" onClick={() => show(c.code)}>
                <td className="td font-medium">{c.code}</td>
                <td className="td">
                  {c.label}
                  {c.notes && <div className="text-xs text-amber-700">{t(c.notes)}</div>}
                </td>
                <td className="td text-xs">{c.idbank ?? <span className="text-slate-400">{t('saisie manuelle')}</span>}</td>
                <td className="td whitespace-nowrap tabular-nums">{c.last_month ? `${fmtNumber(c.last_value, 1)} (${fmtMonth(c.last_month)})` : '—'}</td>
                <td className="td text-xs">
                  {c.last_error ? <span className="text-red-700">{c.last_error}</span> : c.last_check ? fmtDate(c.last_check) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {values && (
        <div className="rounded border border-slate-200 p-2 text-xs">
          <div className="mb-1 font-semibold">{t('Valeurs de {code}', { code: values.code })}</div>
          {values.rows.length ? (
            <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4 md:grid-cols-6">
              {values.rows.slice(0, 36).map((v) => (
                <span key={v.month} className="tabular-nums">
                  {fmtMonth(v.month)} : <b>{fmtNumber(v.value, 1)}</b> {v.status === 'provisoire' && <Badge value="provisoire" />}
                </span>
              ))}
            </div>
          ) : (
            t('Aucune valeur.')
          )}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded border border-slate-200 p-3">
          <div className="text-sm font-medium">{t('Saisir une valeur')}</div>
          <div className="flex flex-wrap gap-2">
            <input className="input w-28" list="index-codes-all" placeholder="BT01" value={entry.code} onChange={(e) => setEntry({ ...entry, code: e.target.value.toUpperCase() })} />
            <datalist id="index-codes-all">{catalog.map((c) => <option key={c.code} value={c.code} />)}</datalist>
            <input className="input w-40" type="month" value={entry.month} onChange={(e) => setEntry({ ...entry, month: e.target.value })} />
            <input className="input w-28" placeholder="139,4" value={entry.value} onChange={(e) => setEntry({ ...entry, value: e.target.value })} />
            <button className="btn-secondary" onClick={addValue} disabled={!entry.code || !entry.month || !entry.value}>
              <Plus size={16} /> {t('Ajouter')}
            </button>
          </div>
          <FileDrop compact multiple={false} onFiles={importFile} label={t('Ou importez un fichier Excel / CSV (colonnes Indice, Mois, Valeur — ou Mois puis une colonne par indice)')} />
        </div>
        <div className="space-y-2 rounded border border-slate-200 p-3">
          <div className="text-sm font-medium">{t('Ajouter un indice au catalogue')}</div>
          <div className="flex flex-wrap gap-2">
            <input className="input w-28" placeholder="TP02" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <input className="input min-w-0 flex-1" placeholder={t('Libellé')} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <input className="input w-32" placeholder="idbank INSEE" value={form.idbank} onChange={(e) => setForm({ ...form, idbank: e.target.value })} />
            <button className="btn-secondary" onClick={addIndex} disabled={!form.code}>
              <Plus size={16} /> {t('Ajouter')}
            </button>
          </div>
          <p className="text-xs text-slate-400">{t('Sans idbank, l’indice est alimenté par saisie ou import (indices non publiés par l’INSEE, indices étrangers…).')}</p>
        </div>
      </div>
    </section>
  );
}
