import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, FilePlus2, History, Pencil, ScanText, Trash2 } from 'lucide-react';
import { api, fileUrl, type Rec } from '../api';
import { DOCUMENT_CATEGORIES, DOCUMENT_FIELDS } from '../schemas';
import { fmtDate, fmtDateTime, fmtSize } from '../format';
import { EntityForm } from './EntityForm';
import { Empty, FileDrop, Modal, toast, toastError } from './ui';

export function DocumentsPanel({
  contractId,
  filter = {},
  compact,
  defaultCategory = 'Autre',
}: {
  contractId: number;
  /** Rattache les documents à un élément (ex. { early_warning_id: 3 }). */
  filter?: Rec;
  compact?: boolean;
  defaultCategory?: string;
}) {
  const [docs, setDocs] = useState<Rec[]>([]);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [uploadCategory, setUploadCategory] = useState(defaultCategory);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [versionsOf, setVersionsOf] = useState<{ doc: Rec; rows: Rec[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const versionInput = useRef<HTMLInputElement>(null);
  const versionParent = useRef<Rec | null>(null);
  const filterKey = JSON.stringify(filter);

  const load = useCallback(() => {
    const params = new URLSearchParams({ contract_id: String(contractId), ...JSON.parse(filterKey) });
    api.get(`/api/documents?${params}`).then(setDocs).catch(toastError);
  }, [contractId, filterKey]);
  useEffect(load, [load]);
  // OCR en tâche de fond : on rafraîchit tant qu'un document est en attente ou en cours.
  const ocrRunning = docs.some((d) => d.text_status === 'ocr en attente' || d.text_status === 'ocr en cours');
  useEffect(() => {
    if (!ocrRunning) return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [ocrRunning, docs, load]);

  const rerunOcr = async (doc: Rec) => {
    try {
      await api.post(`/api/documents/${doc.id}/ocr`, {});
      toast('OCR relancé : le texte sera disponible dans quelques instants');
      load();
    } catch (e) {
      toastError(e);
    }
  };

  const upload = async (files: File[], extra: Rec = {}) => {
    setBusy(true);
    try {
      const saved = await api.upload('/api/documents/upload', files, { contract_id: contractId, category: uploadCategory, ...filter, ...extra });
      toast(saved.length > 1 ? `${saved.length} documents archivés` : `« ${saved[0].title} » archivé (v${saved[0].version})`);
      load();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc: Rec) => {
    if (!confirm(`Supprimer « ${doc.title} » (v${doc.version}) ?\nLe fichier sera déplacé dans le dossier corbeille.`)) return;
    await api.del(`/api/documents/${doc.id}`).catch(toastError);
    load();
  };

  const showVersions = async (doc: Rec) => setVersionsOf({ doc, rows: await api.get(`/api/documents/${doc.id}/versions`) });

  const q = query.toLowerCase();
  const shown = docs.filter(
    (d) => (!category || d.category === category) && (!q || `${d.title} ${d.original_name} ${d.reference ?? ''} ${d.notes ?? ''}`.toLowerCase().includes(q)),
  );
  const categories = [...new Set(docs.map((d) => d.category))];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-56">
          <span className="label">Catégorie des fichiers déposés</span>
          <select className="input" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="min-w-[240px] flex-1">
          <FileDrop compact onFiles={(f) => upload(f)} label={busy ? 'Envoi en cours…' : 'Glissez vos fichiers ici ou cliquez pour parcourir'} />
        </div>
      </div>

      {!compact && docs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" placeholder="Filtrer…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input max-w-[220px]" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Toutes catégories ({docs.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c} ({docs.filter((d) => d.category === c).length})
              </option>
            ))}
          </select>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty>Aucun document.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Document</th>
                <th className="th">Catégorie</th>
                <th className="th">Date</th>
                <th className="th">Version</th>
                {!compact && <th className="th">Taille</th>}
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="td">
                    <a href={fileUrl(d)} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                      {d.title}
                    </a>
                    <div className="text-xs text-slate-400">
                      {d.original_name}
                      {d.reference && ` · réf. ${d.reference}`}
                      <TextStatus doc={d} />
                    </div>
                  </td>
                  <td className="td whitespace-nowrap">{d.category}</td>
                  <td className="td whitespace-nowrap">{fmtDate(d.doc_date || d.created_at)}</td>
                  <td className="td whitespace-nowrap">
                    {d.versions_count > 1 ? (
                      <button className="text-indigo-700 hover:underline" onClick={() => showVersions(d)}>
                        v{d.version} / {d.versions_count}
                      </button>
                    ) : (
                      `v${d.version}`
                    )}
                  </td>
                  {!compact && <td className="td whitespace-nowrap">{fmtSize(d.size)}</td>}
                  <td className="td">
                    <div className="flex justify-end gap-0.5">
                      <a className="btn-ghost !p-1.5" title="Ouvrir" href={fileUrl(d)} target="_blank" rel="noreferrer">
                        <Eye size={16} />
                      </a>
                      <a className="btn-ghost !p-1.5" title="Télécharger" href={fileUrl(d, true)}>
                        <Download size={16} />
                      </a>
                      <button
                        className="btn-ghost !p-1.5"
                        title="Déposer une nouvelle version"
                        onClick={() => {
                          versionParent.current = d;
                          versionInput.current?.click();
                        }}
                      >
                        <FilePlus2 size={16} />
                      </button>
                      <button className="btn-ghost !p-1.5" title="Historique des versions" onClick={() => showVersions(d)}>
                        <History size={16} />
                      </button>
                      {/\.(pdf|png|jpe?g|bmp|tiff?)$/i.test(d.original_name) && ['vide', 'ocr', 'ocr vide', 'ocr échoué', 'non supporté'].includes(d.text_status) && (
                        <button className="btn-ghost !p-1.5" title="Relancer la reconnaissance de texte (OCR)" onClick={() => rerunOcr(d)}>
                          <ScanText size={16} />
                        </button>
                      )}
                      <button className="btn-ghost !p-1.5" title="Modifier les informations" onClick={() => setEditing(d)}>
                        <Pencil size={16} />
                      </button>
                      <button className="btn-ghost !p-1.5 text-red-600" title="Supprimer" onClick={() => remove(d)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <input
        ref={versionInput}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && versionParent.current) upload([file], { parent_id: versionParent.current.id, category: versionParent.current.category });
        }}
      />

      {editing && (
        <Modal title={`Document : ${editing.title}`} onClose={() => setEditing(null)}>
          <EntityForm
            fields={DOCUMENT_FIELDS}
            initial={editing}
            contractId={contractId}
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              try {
                await api.put(`/api/documents/${editing.id}`, values);
                setEditing(null);
                load();
              } catch (e) {
                toastError(e);
              }
            }}
          />
        </Modal>
      )}

      {versionsOf && (
        <Modal title={`Versions : ${versionsOf.doc.title}`} onClose={() => setVersionsOf(null)}>
          <ul className="divide-y divide-slate-100">
            {versionsOf.rows.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">v{v.version}</span> {v.is_current ? <span className="text-xs text-emerald-700">(courante)</span> : null}
                  <div className="text-xs text-slate-500">
                    {v.original_name} · déposé le {fmtDateTime(v.created_at)} · {fmtSize(v.size)}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400" title="Empreinte SHA-256 (preuve d'intégrité)">
                    SHA-256 {v.sha256}
                  </div>
                </div>
                <div className="flex gap-1">
                  <a className="btn-secondary" href={fileUrl(v)} target="_blank" rel="noreferrer">
                    Ouvrir
                  </a>
                  <a className="btn-secondary" href={fileUrl(v, true)}>
                    Télécharger
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

/** État du texte du document : OCR en cours, lu par OCR (avec confiance) ou illisible. */
function TextStatus({ doc }: { doc: Rec }) {
  const s = doc.text_status;
  if (s === 'ocr en attente' || s === 'ocr en cours')
    return <span className="ml-1.5 rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-800">{s === 'ocr en cours' ? 'OCR en cours…' : 'OCR en attente'}</span>;
  if (s === 'ocr')
    return (
      <span className={`ml-1.5 rounded px-1 text-[10px] font-medium ${doc.ocr_confidence < 70 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`} title="Texte reconnu par OCR (confiance moyenne)">
        OCR {doc.ocr_confidence ?? '?'} %
      </span>
    );
  if (['vide', 'ocr vide', 'ocr échoué'].includes(s)) return <span className="ml-1.5 rounded bg-red-100 px-1 text-[10px] font-medium text-red-800">texte illisible</span>;
  return null;
}
