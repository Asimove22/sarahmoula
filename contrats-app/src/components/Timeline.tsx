import type { Rec } from '../api';
import { fmtDate, todayIso } from '../format';

const ms = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/**
 * Frise des jalons : losange gris = date contractuelle, rond bleu = prévision,
 * rond vert = date réelle. Le trait entre les deux matérialise le glissement.
 */
export function Timeline({ milestones, contract }: { milestones: Rec[]; contract: Rec }) {
  const rows = milestones.filter((m) => m.planned_date || m.forecast_date || m.actual_date);
  if (!rows.length) return null;
  const dates = [
    ...rows.flatMap((m) => [m.planned_date, m.forecast_date, m.actual_date]),
    contract.start_date,
    contract.completion_date,
    todayIso(),
  ].filter(Boolean) as string[];
  const min = Math.min(...dates.map(ms));
  const max = Math.max(...dates.map(ms));
  const span = Math.max(max - min, 86400000);
  const x = (iso: string) => `${(((ms(iso) - min) / span) * 100).toFixed(2)}%`;

  return (
    <div className="card p-4">
      <div className="mb-2 ml-[10.75rem] flex justify-between text-xs text-slate-400">
        <span>{fmtDate(new Date(min).toISOString())}</span>
        <span className="flex gap-3">
          <span>◆ prévu</span>
          <span className="text-indigo-600">● prévision</span>
          <span className="text-emerald-600">● réel</span>
        </span>
        <span>{fmtDate(new Date(max).toISOString())}</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((m) => {
          const end = m.actual_date || m.forecast_date;
          const late = m.planned_date && end && end > m.planned_date;
          const [a, b] = m.planned_date && end ? [m.planned_date, end].sort() : [];
          return (
            <div key={m.id} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-xs text-slate-600" title={m.title}>
                {m.title}
              </span>
              <div className="relative h-6 flex-1">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-200" />
                <div className="absolute bottom-0 top-0 w-px bg-red-400" style={{ left: x(todayIso()) }} title="Aujourd'hui" />
                {a && b && <div className={`absolute top-1/2 h-0.5 -translate-y-1/2 ${late ? 'bg-red-300' : 'bg-emerald-300'}`} style={{ left: x(a), width: `calc(${x(b)} - ${x(a)})` }} />}
                {m.planned_date && (
                  <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-slate-500" style={{ left: x(m.planned_date) }} title={`Prévu : ${fmtDate(m.planned_date)}`}>
                    ◆
                  </span>
                )}
                {m.forecast_date && !m.actual_date && (
                  <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600" style={{ left: x(m.forecast_date) }} title={`Prévision : ${fmtDate(m.forecast_date)}`} />
                )}
                {m.actual_date && (
                  <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600" style={{ left: x(m.actual_date) }} title={`Réel : ${fmtDate(m.actual_date)}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
