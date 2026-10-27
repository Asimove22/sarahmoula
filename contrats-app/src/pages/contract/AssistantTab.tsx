import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Cloud, HardDrive, Send } from 'lucide-react';
import { api, fileUrl, type Rec } from '../../api';
import { toastError } from '../../components/ui';

const SUGGESTIONS = [
  'Quel est le régime des pénalités de retard et leur plafond ?',
  'Quels délais de notification dois-je respecter, et sous quelle forme ?',
  'Quelles sont les conditions de la réception et des garanties ?',
  'Comment sont révisés les prix ?',
  'Quelles sont mes obligations d’assurance ?',
];

/** Questions libres sur le contrat : l'IA répond à partir des passages pertinents des documents archivés. */
export function AssistantTab({ contract }: { contract: Rec }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Rec[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setBusy(true);
    setQuestion('');
    try {
      const out = await api.post('/api/ai/ask', { contract_id: contract.id, question: q });
      setHistory((h) => [{ question: q, ...out }, ...h]);
    } catch (e) {
      toastError(e);
      setQuestion(q);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <Bot size={18} className="text-indigo-600" />
          {contract.ai_allow_cloud ? (
            <span className="flex items-center gap-1">
              <Cloud size={14} /> Claude (cloud) : les extraits pertinents sont envoyés à l’API Anthropic.
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <HardDrive size={14} /> IA locale (Ollama) : rien ne quitte votre PC.
            </span>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <input className="input flex-1" placeholder="Posez une question sur ce contrat…" value={question} onChange={(e) => setQuestion(e.target.value)} disabled={busy} />
          <button className="btn-primary" disabled={busy || !question.trim()}>
            <Send size={16} /> {busy ? 'Réflexion…' : 'Demander'}
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => ask(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {history.map((h, i) => (
        <div key={i} className="card space-y-2 p-4">
          <div className="text-sm font-semibold">{h.question}</div>
          <div className="whitespace-pre-line text-sm leading-relaxed">{h.answer}</div>
          {h.sources.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2 text-xs">
              <span className="text-slate-400">Sources :</span>
              {h.sources.map((s: Rec) => (
                <a key={s.id} className="text-indigo-700 hover:underline" href={fileUrl(s)} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              ))}
            </div>
          )}
          <div className="text-[11px] text-slate-400">Réponse générée par {h.provider === 'claude' ? 'Claude' : 'l’IA locale'} : vérifiez dans le document source avant de vous engager.</div>
        </div>
      ))}

      {history.length === 0 && (
        <p className="text-sm text-slate-500">
          L’assistant lit les documents texte de la GED (PDF natifs, Word, Excel, emails). Pour une analyse complète des clauses, utilisez plutôt l’onglet{' '}
          <Link className="text-indigo-700 underline" to={`/contrats/${contract.id}?tab=revue`}>
            Revue
          </Link>
          .
        </p>
      )}
    </div>
  );
}
