import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { Rec } from '../api';
import { ENTITY_LABELS, TAB_FOR_ENTITY } from '../schemas';
import { daysFromToday, fmtDate, relativeDays } from '../format';
import { Empty } from './ui';

export const deadlineLink = (d: Rec) =>
  `/contrats/${d.contract_id}?tab=${TAB_FOR_ENTITY[d.entity]}${d.entity === 'contracts' ? '' : `&open=${d.entity_id}`}`;

function tone(d: Rec) {
  const n = daysFromToday(d.date);
  if (n < 0) return 'bg-red-100 text-red-700';
  if (n <= 7) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-600';
}

export function DeadlineList({ items, showContract = true, empty = 'Aucune échéance.' }: { items: Rec[]; showContract?: boolean; empty?: string }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((d, i) => (
        <li key={`${d.entity}-${d.entity_id}-${d.title}-${i}`}>
          <Link to={deadlineLink(d)} className="flex items-center gap-3 px-1 py-2 hover:bg-slate-50">
            <div className="w-20 shrink-0 text-sm font-medium tabular-nums">{fmtDate(d.date)}</div>
            <span className={`w-24 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium ${tone(d)}`}>{relativeDays(d.date)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-sm">
                {d.critical && <AlertTriangle size={14} className="shrink-0 text-red-500" />}
                <span className="truncate">{d.title}</span>
              </div>
              <div className="truncate text-xs text-slate-400">
                {ENTITY_LABELS[d.entity]}
                {showContract && ` · ${d.contract_reference ? `${d.contract_reference} – ` : ''}${d.contract_title}`}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
