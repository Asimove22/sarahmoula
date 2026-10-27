import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Upload, X } from 'lucide-react';
import { STATUS_COLORS } from '../schemas';

export function Badge({ value, className = '' }: { value?: string | null; className?: string }) {
  if (!value) return null;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[value] ?? 'bg-slate-100 text-slate-700'} ${className}`}>
      {value}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? 'max-w-5xl' : 'max-w-3xl'} my-4`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn-ghost !p-1" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Stat({ label, value, tone = 'slate', icon }: { label: string; value: ReactNode; tone?: 'slate' | 'red' | 'amber' | 'indigo' | 'emerald'; icon?: ReactNode }) {
  const tones = {
    slate: 'text-slate-900',
    red: 'text-red-600',
    amber: 'text-amber-600',
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600',
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      {icon && <div className="rounded-md bg-slate-100 p-2 text-slate-500">{icon}</div>}
      <div>
        <div className={`text-2xl font-semibold ${tones[tone]}`}>{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

/** Zone de glisser-déposer qui accepte aussi le clic pour choisir des fichiers. */
export function FileDrop({ onFiles, label, compact, multiple = true }: { onFiles: (files: File[]) => void; label: string; compact?: boolean; multiple?: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      onClick={() => input.current?.click()}
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm transition ${
        over ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:bg-slate-50'
      } ${compact ? 'p-3' : 'p-6'}`}
    >
      <Upload size={18} />
      <span>{label}</span>
      <input
        ref={input}
        type="file"
        multiple={multiple}
        hidden
        // Sans cela, le clic sur l'input remonte à la zone et rouvre le sélecteur.
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}

// ---------- Notifications (toasts) ----------
type Toast = { id: number; message: string; tone: 'ok' | 'error' };
let listeners: ((t: Toast[]) => void)[] = [];
let toasts: Toast[] = [];
let nextId = 1;

export function toast(message: string, tone: Toast['tone'] = 'ok') {
  const t = { id: nextId++, message, tone };
  toasts = [...toasts, t];
  listeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    listeners.forEach((l) => l(toasts));
  }, tone === 'error' ? 7000 : 3500);
}

export const toastError = (e: unknown) => toast(e instanceof Error ? e.message : String(e), 'error');

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={`rounded-md px-4 py-2 text-sm text-white shadow-lg ${t.tone === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
