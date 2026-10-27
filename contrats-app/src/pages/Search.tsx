import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type Rec } from '../api';
import { Empty, toastError } from '../components/ui';
import { ENTITY_LABELS, TAB_FOR_ENTITY } from '../schemas';

const link = (r: Rec) =>
  r.kind === 'contracts' ? `/contrats/${r.id}` : `/contrats/${r.contract_id}?tab=${TAB_FOR_ENTITY[r.kind]}${r.kind === 'documents' ? '' : `&open=${r.id}`}`;

export function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [results, setResults] = useState<Rec[] | null>(null);

  useEffect(() => {
    setInput(q);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    api.get(`/api/search?q=${encodeURIComponent(q)}`).then(setResults).catch(toastError);
  }, [q]);

  const groups = Object.keys(ENTITY_LABELS)
    .map((kind) => [kind, (results ?? []).filter((r) => r.kind === kind)] as const)
    .filter(([, rows]) => rows.length);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Recherche</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ q: input });
        }}
        className="flex gap-2"
      >
        <input autoFocus className="input max-w-lg" placeholder="Référence, objet, cocontractant, nom de fichier, texte d'un email…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn-primary">Rechercher</button>
      </form>
      {results && groups.length === 0 && <Empty>Aucun résultat pour « {q} ».</Empty>}
      {groups.map(([kind, rows]) => (
        <section key={kind} className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">
            {ENTITY_LABELS[kind]}s ({rows.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={link(r)} className="block px-1 py-1.5 hover:bg-slate-50">
                  <span className="text-sm text-indigo-700">{r.title}</span>
                  {r.subtitle && <span className="ml-2 text-xs text-slate-400">{r.subtitle}</span>}
                </Link>
                {kind === 'documents' && (
                  <a className="ml-1 text-xs text-slate-500 underline" href={`/api/documents/${r.id}/file`} target="_blank" rel="noreferrer">
                    ouvrir le fichier
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
