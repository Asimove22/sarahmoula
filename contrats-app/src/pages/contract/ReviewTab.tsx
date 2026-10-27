import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardList, History, RefreshCw, Sparkles, X } from 'lucide-react';
import { api, type Rec } from '../../api';
import { RegisterPanel } from '../../components/RegisterPanel';
import { ImportExportButtons } from '../../components/ImportModal';
import { Badge, Modal, toast, toastError } from '../../components/ui';
import { REVIEW_FIELDS } from '../../schemas';
import { fmtDateTime } from '../../format';

/** Revue de contrat : check-list type par cadre contractuel + analyse IA des pièces. */
export function ReviewTab({ contract, openId, onChange }: { contract: Rec; openId?: number; onChange: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const refresh = () => {
    setRefreshKey((k) => k + 1);
    onChange();
  };

  const loadTemplate = async () => {
    try {
      const { added } = await api.post(`/api/contracts/${contract.id}/review/template`, {});
      toast(added ? `${added} point(s) de contrôle ajoutés` : 'La check-list est déjà chargée');
      refresh();
    } catch (e) {
      toastError(e);
    }
  };

  const reanalyze = async () => {
    setReanalyzing(true);
    try {
      const { created } = await api.post(`/api/contracts/${contract.id}/review/reanalyze`, {});
      toast(created ? `${created} mise(s) à jour proposée(s) par l’IA` : 'L’IA ne propose aucune modification de la revue');
      refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <>
      <ReviewUpdates contractId={contract.id} refreshKey={refreshKey} onApplied={refresh} />
      <RegisterPanel
        table="review_items"
        contractId={contract.id}
        title="Revue du contrat"
        addLabel="Ajouter un point"
        emptyText="Aucun point de revue. Chargez la check-list type adaptée au cadre contractuel ou lancez l’analyse IA des pièces du marché."
        fields={REVIEW_FIELDS}
        defaults={{ status: 'à analyser', risk_level: 'moyen' }}
        openId={openId}
        refreshKey={refreshKey}
        onChange={onChange}
        toolbar={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={loadTemplate}>
              <ClipboardList size={16} /> Charger la check-list type
            </button>
            <button className="btn-secondary" onClick={() => setAiOpen(true)}>
              <Sparkles size={16} /> Analyser les pièces avec l’IA
            </button>
            <button className="btn-secondary" onClick={reanalyze} disabled={reanalyzing} title="L’IA confronte la revue aux événements des 60 derniers jours">
              <RefreshCw size={16} className={reanalyzing ? 'animate-spin' : ''} /> {reanalyzing ? 'Réanalyse…' : 'Réanalyser avec les événements récents'}
            </button>
            <ImportExportButtons contractId={contract.id} kind="review" onImported={refresh} />
          </div>
        }
        rowClassName={(r) => (r.risk_level === 'critique' && r.status !== 'accepté' ? 'bg-red-50/60' : '')}
        columns={[
          { key: 'theme', label: 'Thème', className: 'font-medium' },
          { key: 'clause_ref', label: 'Clause', className: 'whitespace-nowrap' },
          { key: 'content', label: 'Constat', render: (r) => <span className="line-clamp-3 text-xs">{r.content ?? '—'}</span> },
          { key: 'risk_level', label: 'Risque', render: (r) => <Badge value={r.risk_level} /> },
          { key: 'mitigation', label: 'Maîtrise', render: (r) => <span className="line-clamp-2 text-xs">{r.mitigation ?? '—'}</span> },
          { key: 'status', label: 'Statut', render: (r) => <Badge value={r.status} /> },
          {
            key: 'history',
            label: 'Évolution',
            render: (r) =>
              r.history ? (
                <span className="flex items-start gap-1 text-xs text-slate-500" title={r.history}>
                  <History size={12} className="mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{r.history.split('\n')[0]}</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400">{r.source}</span>
              ),
          },
        ]}
      />
      {aiOpen && <AiReviewModal contract={contract} onClose={() => setAiOpen(false)} onApplied={refresh} />}
    </>
  );
}

function AiReviewModal({ contract, onClose, onApplied }: { contract: Rec; onClose: () => void; onApplied: () => void }) {
  const [docs, setDocs] = useState<Rec[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<Rec | null>(null);
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/api/documents?contract_id=${contract.id}`).then((rows) => {
      const usable = rows.filter((d) => ['ok', 'ocr'].includes(d.text_status));
      setDocs(usable);
      setSelected(new Set(usable.filter((d) => !['Échange', 'Pièce jointe', 'Facture / Situation', 'Compte rendu / PV'].includes(d.category)).map((d) => d.id)));
    });
  }, [contract.id]);

  const run = async () => {
    setBusy(true);
    try {
      const out = await api.post('/api/ai/review', { contract_id: contract.id, document_ids: [...selected] });
      setResult(out);
      const k: Record<string, boolean> = {};
      out.review_items.forEach((_: Rec, i: number) => (k[`r${i}`] = true));
      out.key_dates.forEach((d: Rec, i: number) => (k[`d${i}`] = /^\d{4}-\d{2}-\d{2}$/.test(d.date)));
      out.obligations.forEach((_: Rec, i: number) => (k[`o${i}`] = true));
      setKeep(k);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    try {
      const { created } = await api.post('/api/ai/review/apply', {
        contract_id: contract.id,
        review_items: result!.review_items.filter((_: Rec, i: number) => keep[`r${i}`]),
        key_dates: result!.key_dates.filter((_: Rec, i: number) => keep[`d${i}`]),
        obligations: result!.obligations.filter((_: Rec, i: number) => keep[`o${i}`]),
      });
      toast(`${created} élément(s) ajouté(s) à la revue et au planning`);
      onApplied();
      onClose();
    } catch (e) {
      toastError(e);
    }
  };

  const check = (key: string) => (
    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={Boolean(keep[key])} onChange={(e) => setKeep({ ...keep, [key]: e.target.checked })} />
  );

  return (
    <Modal title="Revue de contrat assistée par l’IA" onClose={onClose} wide>
      {!result ? (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            Pièces analysées par {contract.ai_allow_cloud ? <b>Claude (cloud)</b> : <b>l’IA locale (Ollama)</b>}. Les PDF scannés sans texte ne sont pas lisibles.
          </p>
          {docs.length === 0 ? (
            <p className="text-red-600">Aucun document texte : déposez d’abord le contrat, le CCAP, le CCTP…</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
              {docs.map((d) => (
                <li key={d.id}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(d.id);
                        else next.delete(d.id);
                        setSelected(next);
                      }}
                    />
                    <span>{d.title}</span>
                    <span className="text-xs text-slate-400">{d.category}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button className="btn-primary" onClick={run} disabled={busy || selected.size === 0}>
              <Sparkles size={16} /> {busy ? 'Analyse en cours (peut prendre plusieurs minutes)…' : 'Lancer l’analyse'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {result.omitted?.length > 0 && (
            <p className="rounded bg-amber-50 p-2 text-amber-800">Volume trop important pour le moteur : non transmis ou tronqués → {result.omitted.join(', ')}.</p>
          )}
          <div className="rounded bg-slate-50 p-3 whitespace-pre-line">{result.summary}</div>
          <section>
            <h3 className="mb-1 font-semibold">Clauses à analyser ({result.review_items.length})</h3>
            <ul className="space-y-1.5">
              {result.review_items.map((r: Rec, i: number) => (
                <li key={i} className="flex gap-2">
                  {check(`r${i}`)}
                  <div>
                    <b>{r.theme}</b> <span className="text-slate-400">{r.clause_ref}</span> <Badge value={r.risk_level} />
                    <div className="text-xs text-slate-600">{r.content}</div>
                    {r.mitigation && <div className="text-xs text-emerald-700">→ {r.mitigation}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-1 font-semibold">Dates clés → jalons ({result.key_dates.length})</h3>
            <ul className="space-y-1">
              {result.key_dates.map((d: Rec, i: number) => (
                <li key={i} className="flex gap-2">
                  {check(`d${i}`)}
                  <span>
                    {d.title} — <b>{d.date || 'date relative (non importée)'}</b> <span className="text-slate-400">{d.clause_ref}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-1 font-semibold">Obligations à délai ({result.obligations.length})</h3>
            <ul className="space-y-1">
              {result.obligations.map((o: Rec, i: number) => (
                <li key={i} className="flex gap-2">
                  {check(`o${i}`)}
                  <span>
                    {o.title} — <b>{o.deadline}</b> <span className="text-slate-400">{o.clause_ref}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <p className="text-xs text-slate-500">Proposition générée par l’IA : vérifiez chaque point dans les pièces avant de vous y fier.</p>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button className="btn-secondary" onClick={onClose}>
              Fermer
            </button>
            <button className="btn-primary" onClick={apply}>
              Ajouter la sélection
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const CHANGE_LABELS: Record<string, string> = { risk_level: 'Risque', status: 'Statut', mitigation: 'Maîtrise', theme: 'Thème', clause_ref: 'Clause', content: 'Contenu' };

/** Propositions de la veille de revue (règles et IA) à accepter ou rejeter. */
function ReviewUpdates({ contractId, refreshKey, onApplied }: { contractId: number; refreshKey: number; onApplied: () => void }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const load = useCallback(() => {
    api.get(`/api/review_updates?contract_id=${contractId}&status=${encodeURIComponent('proposée')}`).then(setRows).catch(toastError);
  }, [contractId]);
  useEffect(load, [load, refreshKey]);
  // La veille travaille en tâche de fond : on relit les propositions régulièrement.
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const decide = async (u: Rec, decision: 'accept' | 'reject') => {
    try {
      await api.post(`/api/review_updates/${u.id}/${decision}`, {});
      setRows((r) => r.filter((x) => x.id !== u.id));
      if (decision === 'accept') onApplied();
    } catch (e) {
      toastError(e);
    }
  };
  const acceptAll = async () => {
    if (!confirm(`Accepter les ${rows.length} propositions ?`)) return;
    for (const u of rows) await api.post(`/api/review_updates/${u.id}/accept`, {}).catch(toastError);
    load();
    onApplied();
  };

  if (!rows.length) return null;
  return (
    <section className="card mb-4 border-amber-300 bg-amber-50/40 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-semibold">Veille de revue : {rows.length} mise(s) à jour proposée(s)</h3>
        <button className="btn-secondary" onClick={acceptAll}>
          <Check size={16} /> Tout accepter
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">Chaque nouvel événement (courrier, Early Warning, CE, avenant, planning, visa, pièce contractuelle) est confronté à votre revue. Rien n’est modifié sans votre accord.</p>
      <ul className="space-y-2">
        {rows.map((u) => {
          const p = JSON.parse(u.proposed || '{}');
          const changes = Object.entries(p).filter(([k]) => k !== 'note' && CHANGE_LABELS[k]);
          return (
            <li key={u.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500">
                    {fmtDateTime(u.created_at)} · {u.trigger_label} <Badge value={u.source === 'IA' ? 'IA' : 'règle'} className={u.source === 'IA' ? '!bg-violet-100 !text-violet-800' : ''} />
                  </div>
                  <div className="mt-0.5 font-medium">
                    {u.kind === 'nouveau point' ? <>Nouveau point : {p.theme}</> : <>{u.item_theme} {u.item_clause && <span className="font-normal text-slate-400">{u.item_clause}</span>}</>}
                  </div>
                  {p.note && <div className="text-xs text-slate-600">{p.note}</div>}
                  {u.kind === 'nouveau point' && p.content && <div className="text-xs text-slate-600">{p.content}</div>}
                  {changes.length > 0 && u.kind !== 'nouveau point' && (
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {changes.map(([k, v]) => (
                        <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5">
                          {CHANGE_LABELS[k]} : {k === 'risk_level' ? <>{u.item_risk ?? '—'} → <b>{String(v)}</b></> : k === 'status' ? <>{u.item_status} → <b>{String(v)}</b></> : <b>{String(v)}</b>}
                        </span>
                      ))}
                    </div>
                  )}
                  {u.rationale && <div className="mt-1 text-xs italic text-slate-500">{u.rationale}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn-primary !px-2" onClick={() => decide(u, 'accept')} title="Accepter et appliquer">
                    <Check size={16} />
                  </button>
                  <button className="btn-secondary !px-2" onClick={() => decide(u, 'reject')} title="Rejeter">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
