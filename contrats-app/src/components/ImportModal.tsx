import { useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { Rec } from '../api';
import { Badge, FileDrop, Modal, toast, toastError } from './ui';

export type ImportKind = 'review' | 'raci' | 'communication';

const TITLES: Record<ImportKind, string> = {
  review: 'Importer une revue de contrat',
  raci: 'Importer une matrice RACI',
  communication: 'Importer une matrice de communication',
};

const FIELD_LABELS: Record<string, string> = {
  theme: 'Thème',
  clause_ref: 'Clause / article',
  content: 'Contenu / constat',
  risk_level: 'Niveau de risque',
  mitigation: 'Mesure de maîtrise',
  owner: 'Responsable',
  status: 'Statut',
  subject: 'Information / document',
  info_type: 'Type',
  sender: 'Émetteur',
  recipients: 'Destinataires',
  cc: 'Copie',
  channel: 'Canal',
  frequency: 'Fréquence',
  delay_days: 'Délai (j)',
  clause: 'Clause',
  notes: 'Notes',
  activity: 'Activité',
  wbs_code: 'Code WBS',
};

const HELP: Record<ImportKind, string> = {
  review: 'Colonnes reconnues : Thème, Clause/Article, Contenu/Constat, Risque/Criticité (faible…critique, 1-4, ou score P×G), Mesure/Plan d’action, Responsable, Statut. Un point déjà présent (même thème et même clause) est mis à jour, pas dupliqué.',
  raci: 'Une colonne Activité (et éventuellement Code WBS), puis une colonne par intervenant contenant R, A, C ou I (« R/A » accepté, S = C). Les intervenants inconnus sont créés.',
  communication: 'Colonnes reconnues : Information/Document, Type, Émetteur, Destinataires, Copie, Canal, Fréquence, Délai, Clause, Notes.',
};

async function post(url: string, file: File, fields: Rec) {
  const form = new FormData();
  form.append('file', file, file.name);
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  const res = await fetch(url, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

/** Import Excel / CSV en deux temps : aperçu avec correspondance des colonnes, puis import. */
export function ImportModal({ contractId, kind, onClose, onDone }: { contractId: number; kind: ImportKind; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Rec | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<string>();
  const [mode, setMode] = useState('ajouter');
  const [busy, setBusy] = useState(false);

  const load = async (f: File, opts: Rec = {}) => {
    setBusy(true);
    try {
      const p = await post(`/api/contracts/${contractId}/import/${kind}/preview`, f, opts);
      setPreview(p);
      setMapping(p.mapping);
      setSheet(p.sheet);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const changeColumn = (index: number, field: string) => {
    const next = Object.fromEntries(Object.entries(mapping).filter(([k, v]) => k !== String(index) && v !== field));
    if (field) next[index] = field;
    setMapping(next);
    load(file!, { sheet, mapping: next });
  };

  const run = async () => {
    if (mode === 'remplacer' && !confirm('Remplacer : les éléments existants de ce registre seront supprimés avant l’import. Continuer ?')) return;
    setBusy(true);
    try {
      const r = await post(`/api/contracts/${contractId}/import/${kind}`, file!, { sheet, mapping, mode });
      toast(`${r.created} ajouté(s), ${r.updated} mis à jour${r.stakeholders_created ? `, ${r.stakeholders_created} intervenant(s) créé(s)` : ''}. Fichier archivé dans la GED.`);
      onDone();
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={TITLES[kind]} onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">{HELP[kind]}</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[260px] flex-1">
            <FileDrop
              compact
              multiple={false}
              label={file ? `${file.name} — cliquez pour changer` : 'Déposez votre fichier Excel (.xlsx) ou CSV'}
              onFiles={([f]) => {
                setFile(f);
                load(f);
              }}
            />
          </div>
          <a className="btn-secondary" href={`/api/import-templates/${kind}.xlsx`}>
            <Download size={16} /> Modèle Excel
          </a>
        </div>

        {preview && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {preview.sheets.length > 1 && (
                <label className="flex items-center gap-2">
                  Feuille
                  <select className="input w-auto" value={sheet} onChange={(e) => { setSheet(e.target.value); load(file!, { sheet: e.target.value }); }}>
                    {preview.sheets.map((s: string) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}
              <span className="text-slate-500">
                En-têtes en ligne {preview.header_row} · <b>{preview.total}</b> ligne(s) exploitable(s)
              </span>
            </div>

            <div>
              <div className="label">Correspondance des colonnes {kind === 'raci' && '(colonnes non affectées = intervenants)'}</div>
              <div className="flex flex-wrap gap-2">
                {preview.columns.filter((c: Rec) => c.header).map((c: Rec) => (
                  <label key={c.index} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                    <div className="max-w-[180px] truncate text-xs font-medium" title={c.header}>{c.header}</div>
                    <select className="mt-0.5 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs" value={mapping[c.index] ?? ''} onChange={(e) => changeColumn(c.index, e.target.value)}>
                      <option value="">{kind === 'raci' ? 'Intervenant' : '— ignorer —'}</option>
                      {preview.fields.map((f: string) => (
                        <option key={f} value={f}>
                          {FIELD_LABELS[f] ?? f}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            {preview.warnings.map((w: string) => (
              <p key={w} className="flex items-start gap-1.5 rounded bg-amber-50 p-2 text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {w}
              </p>
            ))}

            <div className="max-h-72 overflow-auto rounded border border-slate-200">
              <PreviewTable kind={kind} preview={preview} />
            </div>
            {preview.total > preview.items.length && <p className="text-xs text-slate-400">Aperçu des {preview.items.length} premières lignes sur {preview.total}.</p>}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={mode === 'ajouter'} onChange={() => setMode('ajouter')} /> Ajouter et mettre à jour
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={mode === 'remplacer'} onChange={() => setMode('remplacer')} /> Remplacer l’existant
                </label>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={onClose}>
                  Annuler
                </button>
                <button className="btn-primary" onClick={run} disabled={busy || !preview.total}>
                  <Upload size={16} /> {busy ? 'Import…' : `Importer ${preview.total} ligne(s)`}
                </button>
              </div>
            </div>
          </>
        )}
        {!preview && busy && <p className="text-slate-500">Lecture du fichier…</p>}
      </div>
    </Modal>
  );
}

function PreviewTable({ kind, preview }: { kind: ImportKind; preview: Rec }) {
  const items: Rec[] = preview.items;
  if (kind === 'raci') {
    return (
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            <th className="th">Activité</th>
            {preview.people.map((p: string) => (
              <th key={p} className="th text-center normal-case">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((i, n) => (
            <tr key={n}>
              <td className="td">{i.wbs_code && <span className="mr-1 text-slate-400">{i.wbs_code}</span>}{i.activity}</td>
              {preview.people.map((p: string) => (
                <td key={p} className="td text-center font-bold">{i.cells[p] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const cols = kind === 'review' ? ['theme', 'clause_ref', 'content', 'risk_level', 'mitigation', 'status'] : ['subject', 'sender', 'recipients', 'cc', 'channel', 'delay_days'];
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-slate-50">
        <tr>
          {cols.map((c) => (
            <th key={c} className="th">{FIELD_LABELS[c]}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map((i, n) => (
          <tr key={n}>
            {cols.map((c) => (
              <td key={c} className="td">
                {c === 'risk_level' ? (i.risk_level ? <Badge value={i.risk_level} /> : <span className="text-amber-700">{i.risk_raw ?? '—'}</span>) : <span className="line-clamp-2">{i[c] ?? ''}</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ImportExportButtons({ contractId, kind, onImported }: { contractId: number; kind: ImportKind; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <Upload size={16} /> Importer Excel
      </button>
      <a className="btn-secondary" href={`/api/contracts/${contractId}/export/${kind}.xlsx`}>
        <FileSpreadsheet size={16} /> Exporter Excel
      </a>
      {open && <ImportModal contractId={contractId} kind={kind} onClose={() => setOpen(false)} onDone={onImported} />}
    </>
  );
}
