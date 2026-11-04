import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bot, CheckSquare, Cloud, FileSearch, HardDrive, ListChecks, Send } from 'lucide-react';
import { api, fileUrl, type Rec } from '../../api';
import { Badge, FileDrop, toast, toastError } from '../../components/ui';
import { t } from '../../i18n';

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
  const [analyses, setAnalyses] = useState<Rec[]>([]);
  const [reading, setReading] = useState(false);

  const analyzeFiles = async (files: File[]) => {
    setReading(true);
    try {
      for (const f of files) {
        const out = await api.upload<Rec>(`/api/contracts/${contract.id}/ai/analyze-file`, [f]);
        setAnalyses((a) => [out, ...a]);
        if (out.ai_error) toast(t('IA indisponible, lecture par règles seulement') + ` : ${out.ai_error}`, 'error');
      }
    } catch (e) {
      toastError(e);
    } finally {
      setReading(false);
    }
  };

  const addRisks = async (a: Rec) => {
    try {
      for (const r of a.analysis.risks) {
        await api.post('/api/review_items', { contract_id: contract.id, theme: a.analysis.document_type || t('Document analysé'), content: `${r.text} (${a.document.title})`, risk_level: r.level, status: 'à analyser', source: 'IA – analyse de document' });
      }
      toast(t('{n} risque(s) ajouté(s) à la revue de contrat', { n: a.analysis.risks.length }));
    } catch (e) {
      toastError(e);
    }
  };

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
          <Bot size={18} className="text-brand-600" />
          {contract.ai_effective === 'claude' ? (
            <span className="flex items-center gap-1">
              <Cloud size={14} /> {t('Claude (cloud) : les extraits pertinents sont envoyés à l’API Anthropic.')}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <HardDrive size={14} /> {t('IA locale (Ollama) : rien ne quitte votre PC.')}
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
          <input className="input flex-1" placeholder={t('Posez une question sur ce contrat…')} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={busy} />
          <button className="btn-primary" disabled={busy || !question.trim()}>
            <Send size={16} /> {busy ? t('Réflexion…') : t('Demander')}
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-brand-50 hover:text-brand-700" onClick={() => ask(t(s))} disabled={busy}>
              {t(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-2 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileSearch size={18} className="text-brand-600" /> {t('Analyser un document')}
        </div>
        <FileDrop
          onFiles={analyzeFiles}
          label={reading ? t('Analyse en cours… (quelques minutes avec l’IA locale)') : t('Déposez un document (courrier, avenant, CCTP, compte rendu, facture… en PDF, Word, Excel, PowerPoint) : Clausia l’archive et en extrait synthèse, obligations, délais, risques et actions')}
        />
      </div>

      {analyses.map((a, i) => (
        <div key={`a${i}`} className="card space-y-3 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{a.document.title}</span>
            {a.analysis.document_type && <Badge value={a.analysis.document_type} />}
            <a className="ml-auto text-xs text-brand-700 hover:underline" href={fileUrl(a.document)} target="_blank" rel="noreferrer">
              {t('Ouvrir')} · {t('archivé dans la GED')} ({t(a.document.category)})
            </a>
          </div>
          {a.analysis.summary && <p className="whitespace-pre-line">{a.analysis.summary}</p>}
          {a.analysis.key_points?.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5">
              {a.analysis.key_points.map((p: string, j: number) => <li key={j}>{p}</li>)}
            </ul>
          )}
          {a.analysis.obligations?.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 font-medium"><ListChecks size={15} /> {t('Obligations et délais')}</div>
              <ul className="space-y-1">
                {a.analysis.obligations.map((o: Rec, j: number) => (
                  <li key={j} className="rounded bg-slate-50 px-2 py-1">
                    {o.text}
                    {(o.deadline || o.clause) && <span className="text-xs text-slate-500"> — {[o.deadline, o.clause].filter(Boolean).join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.analysis.risks?.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle size={15} className="text-amber-600" /> {t('Risques')}</div>
              <ul className="space-y-1">
                {a.analysis.risks.map((r: Rec, j: number) => (
                  <li key={j} className="flex items-start gap-2"><Badge value={r.level} /> <span>{r.text}</span></li>
                ))}
              </ul>
            </div>
          )}
          {a.analysis.suggested_actions?.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 font-medium"><CheckSquare size={15} /> {t('Actions proposées')}</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {a.analysis.suggested_actions.map((x: string, j: number) => <li key={j}>{x}</li>)}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
            {a.analysis.risks?.length > 0 && (
              <button className="btn-secondary" onClick={() => addRisks(a)}>
                {t('Ajouter les risques à la revue')}
              </button>
            )}
            <button className="btn-secondary" onClick={() => ask(t('Que dois-je faire suite au document « {title} » ?', { title: a.document.title }))} disabled={busy}>
              {t('Poser une question sur ce document')}
            </button>
            <span className="ml-auto text-[11px] text-slate-400">
              {a.analysis.provider === 'règles' ? t('Lecture par règles (IA désactivée ou indisponible)') : `${t('Analyse générée par')} ${a.analysis.provider === 'claude' ? 'Claude' : t('l’IA locale')}`} {t(': à valider.')}
            </span>
          </div>
        </div>
      ))}

      {history.map((h, i) => (
        <div key={i} className="card space-y-2 p-4">
          <div className="text-sm font-semibold">{h.question}</div>
          <div className="whitespace-pre-line text-sm leading-relaxed">{h.answer}</div>
          {h.sources.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2 text-xs">
              <span className="text-slate-400">{t('Sources :')}</span>
              {h.sources.map((s: Rec) => (
                <a key={s.id} className="text-brand-700 hover:underline" href={fileUrl(s)} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              ))}
            </div>
          )}
          <div className="text-[11px] text-slate-400">{t('Réponse générée par')} {h.provider === 'claude' ? t('Claude') : t('l’IA locale')} {t(': vérifiez dans le document source avant de vous engager.')}</div>
        </div>
      ))}

      {history.length === 0 && analyses.length === 0 && (
        <p className="text-sm text-slate-500">
          {t('L’assistant lit les documents texte de la GED (PDF natifs, Word, Excel, emails). Pour une analyse complète des clauses, utilisez plutôt l’onglet')}{' '}
          <Link className="text-brand-700 underline" to={`/contrats/${contract.id}?tab=revue`}>
            {t('Revue')}
          </Link>
          .
        </p>
      )}
    </div>
  );
}
