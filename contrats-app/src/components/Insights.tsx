import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, Info, Mail } from 'lucide-react';
import type { Rec } from '../api';
import { LetterModal } from './LetterModal';
import { Empty } from './ui';

const ICONS = {
  critique: <AlertOctagon size={16} className="shrink-0 text-red-600" />,
  attention: <AlertTriangle size={16} className="shrink-0 text-amber-600" />,
  info: <Info size={16} className="shrink-0 text-sky-600" />,
};

export const insightLink = (i: Rec) => `/contrats/${i.contract_id}?tab=${i.tab}${i.open ? `&open=${i.open}` : ''}`;

/** Points d'attention calculés par le moteur de règles, avec raccourci vers le courrier conseillé. */
export function Insights({ items, showContract = true, limit }: { items: Rec[]; showContract?: boolean; limit?: number }) {
  const [letter, setLetter] = useState<Rec | null>(null);
  const [all, setAll] = useState(false);
  if (!items.length) return <Empty>Aucun point d’attention : tout est sous contrôle.</Empty>;
  const shown = limit && !all ? items.slice(0, limit) : items;
  return (
    <>
      <ul className="divide-y divide-slate-100">
        {shown.map((i, n) => (
          <li key={n} className="flex items-start gap-2 py-2">
            {ICONS[i.level as keyof typeof ICONS]}
            <div className="min-w-0 flex-1">
              <Link to={insightLink(i)} className="text-sm font-medium hover:text-indigo-700 hover:underline">
                {i.title}
              </Link>
              {i.detail && <div className="text-xs text-slate-500">{i.detail}</div>}
              {showContract && <div className="text-xs text-slate-400">{i.contract_reference ? `${i.contract_reference} – ` : ''}{i.contract_title}</div>}
            </div>
            {i.letter && (
              <button className="btn-ghost shrink-0 !px-2 !py-1 text-xs" onClick={() => setLetter(i)} title="Préparer le courrier conseillé">
                <Mail size={14} /> Courrier
              </button>
            )}
          </li>
        ))}
      </ul>
      {limit && items.length > limit && (
        <button className="mt-1 text-xs text-indigo-700 hover:underline" onClick={() => setAll(!all)}>
          {all ? 'Réduire' : `Voir les ${items.length} points`}
        </button>
      )}
      {letter && <LetterModal contractId={letter.contract_id} template={letter.letter} entityId={letter.open} onClose={() => setLetter(null)} />}
    </>
  );
}
