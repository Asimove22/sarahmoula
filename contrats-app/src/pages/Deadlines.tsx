import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, type Rec } from '../api';
import { DeadlineList, deadlineLink } from '../components/DeadlineList';
import { toastError } from '../components/ui';
import { todayIso } from '../format';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const KIND_COLORS: Record<string, string> = {
  contrat: 'bg-slate-200 text-slate-800',
  early_warning: 'bg-amber-100 text-amber-900',
  compensation_event: 'bg-indigo-100 text-indigo-900',
  correspondence: 'bg-sky-100 text-sky-900',
  milestone: 'bg-emerald-100 text-emerald-900',
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function Deadlines() {
  const [items, setItems] = useState<Rec[]>([]);
  const [contracts, setContracts] = useState<Rec[]>([]);
  const [contractId, setContractId] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    api.get('/api/contracts').then(setContracts).catch(toastError);
  }, []);
  useEffect(() => {
    api.get(`/api/deadlines${contractId ? `?contract_id=${contractId}` : ''}`).then(setItems).catch(toastError);
  }, [contractId]);

  const byDay = useMemo(() => {
    const map = new Map<string, Rec[]>();
    for (const d of items) map.set(d.date, [...(map.get(d.date) ?? []), d]);
    return map;
  }, [items]);

  // Grille du mois, semaines commençant le lundi.
  const first = new Date(month);
  first.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const today = todayIso();
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Échéancier</h1>
        <select className="input w-auto" value={contractId} onChange={(e) => setContractId(e.target.value)}>
          <option value="">Tous les contrats</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.reference ? `${c.reference} – ` : ''}
              {c.title}
            </option>
          ))}
        </select>
        <a className="btn-secondary" href={`/api/calendar.ics${contractId ? `?contract_id=${contractId}` : ''}`}>
          <CalendarPlus size={16} /> Exporter (.ics)
        </a>
      </div>

      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between">
          <button className="btn-ghost" onClick={() => shift(-1)} aria-label="Mois précédent">
            <ChevronLeft size={18} />
          </button>
          <div className="font-semibold capitalize">{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
          <button className="btn-ghost" onClick={() => shift(1)} aria-label="Mois suivant">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded border border-slate-200 bg-slate-200 text-xs">
          {WEEKDAYS.map((w) => (
            <div key={w} className="bg-slate-50 px-1 py-1 text-center font-medium text-slate-500">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const key = iso(d);
            const list = byDay.get(key) ?? [];
            const inMonth = d.getMonth() === month.getMonth();
            return (
              <div key={key} className={`min-h-[84px] bg-white p-1 ${inMonth ? '' : 'opacity-40'}`}>
                <div className={`mb-0.5 text-right ${key === today ? 'font-bold text-indigo-700' : 'text-slate-400'}`}>{d.getDate()}</div>
                {list.slice(0, 3).map((it, i) => (
                  <Link key={i} to={deadlineLink(it)} title={`${it.title} – ${it.contract_title}`} className={`mb-0.5 block truncate rounded px-1 ${KIND_COLORS[it.kind] ?? ''} ${it.critical ? 'ring-1 ring-red-400' : ''}`}>
                    {it.title}
                  </Link>
                ))}
                {list.length > 3 && <div className="text-slate-400">+{list.length - 3} autres</div>}
              </div>
            );
          })}
        </div>
      </div>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Toutes les échéances ouvertes ({items.length})</h2>
        <DeadlineList items={items} showContract={!contractId} />
      </section>
    </div>
  );
}
