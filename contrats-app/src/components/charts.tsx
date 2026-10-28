import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';

/**
 * Petits graphiques sans dépendance (HTML + SVG).
 * Couleurs de séries dans un ordre fixe, validé pour les daltonismes (palette distincte du rouge de marque,
 * qui reste réservé à l'interface et aux alertes).
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];
/** Rampe séquentielle (un seul ton, du clair au foncé) pour les niveaux de risque. */
export const RISK_RAMP: Record<string, string> = { faible: '#F9C6C2', moyen: '#EC8A82', élevé: '#D7000F', critique: '#6E0D12', non_évalué: '#CBD5E1' };
export const NEUTRAL = '#E2E8F0';

type Tip = { x: number; y: number; content: ReactNode } | null;

/** Info-bulle positionnée dans le conteneur du graphique. */
function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const show = (e: React.MouseEvent, content: ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content });
  };
  const hide = () => setTip(null);
  const node = tip && (
    <div
      className="pointer-events-none absolute z-20 min-w-[9rem] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-lg"
      style={{ left: tip.x, top: tip.y, transform: `translate(${tip.x > (ref.current?.clientWidth ?? 0) / 2 ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}
    >
      {tip.content}
    </div>
  );
  return { ref, show, hide, node };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function TipRow({ color, label, value }: { color?: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {color && <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />}
      <span className="text-slate-500">{label}</span>
      <span className="ml-auto pl-3 font-semibold text-slate-900">{value}</span>
    </div>
  );
}

/** Carte de graphique : titre, sous-titre, légende, corps, et tableau des données repliable. */
export function ChartCard({ title, subtitle, legend, children, table, className = '' }: {
  title: string; subtitle?: string; legend?: ReactNode; children: ReactNode; table?: { head: string[]; rows: ReactNode[][] }; className?: string;
}) {
  return (
    <section className={`card flex flex-col gap-3 p-4 ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {legend}
      <div className="min-w-0 flex-1">{children}</div>
      {table && table.rows.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-700">{t('Voir les données')}</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-500">
                  {table.head.map((h) => <th key={h} className="px-1.5 py-1 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {r.map((c, j) => <td key={j} className={`px-1.5 py-1 ${j ? 'text-right tabular-nums' : ''}`}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export type Segment = { key: string; value: number; color: string; label: string };

/** Barres horizontales empilées : une ligne par entité, segments séparés de 2 px. */
export function StackedRows({ rows, max, tooltip, format = (v) => String(v) }: {
  rows: { id: string | number; label: string; sub?: string; segments: Segment[]; total?: ReactNode }[];
  max?: number;
  tooltip: (row: { label: string; segments: Segment[] }, seg: Segment) => ReactNode;
  format?: (v: number) => string;
}) {
  const tip = useTip();
  const scale = max ?? Math.max(1, ...rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0)));
  return (
    <div ref={tip.ref} className="relative space-y-2.5" onMouseLeave={tip.hide}>
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-slate-800" title={r.label}>{r.label}</div>
            {r.sub && <div className="truncate text-[11px] text-slate-500">{r.sub}</div>}
          </div>
          <div className="flex h-5 gap-[2px]">
            {r.segments.filter((s) => s.value > 0).map((s, i, arr) => (
              <div
                key={s.key}
                className={`h-full min-w-[3px] ${i === 0 ? 'rounded-l' : ''} ${i === arr.length - 1 ? 'rounded-r' : ''}`}
                style={{ width: `${(s.value / scale) * 100}%`, background: s.color }}
                onMouseMove={(e) => tip.show(e, tooltip(r, s))}
                aria-label={`${r.label} · ${s.label} : ${format(s.value)}`}
              />
            ))}
          </div>
          <div className="w-12 text-right text-xs tabular-nums text-slate-600">{r.total}</div>
        </div>
      ))}
      {tip.node}
    </div>
  );
}

/** Colonnes verticales (une série), valeur affichée au-dessus de chaque colonne. */
export function Columns({ data, color, height = 160, tooltip, highlight }: {
  data: { key: string; label: string; value: number }[];
  color: string;
  height?: number;
  tooltip: (d: { label: string; value: number }) => ReactNode;
  highlight?: (key: string) => string | undefined;
}) {
  const tip = useTip();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div ref={tip.ref} className="relative" onMouseLeave={tip.hide}>
      <div className="flex items-end gap-1.5 border-b border-slate-300" style={{ height }}>
        {data.map((d) => (
          <div key={d.key} className="flex h-full flex-1 cursor-default flex-col items-center justify-end" onMouseMove={(e) => tip.show(e, tooltip(d))}>
            <span className="mb-0.5 text-[11px] tabular-nums text-slate-600">{d.value || ''}</span>
            <div className="w-full max-w-[28px] rounded-t" style={{ height: `${(d.value / max) * (height - 18)}px`, background: highlight?.(d.key) ?? color }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => <div key={d.key} className="flex-1 truncate text-center text-[11px] text-slate-500">{d.label}</div>)}
      </div>
      {tip.node}
    </div>
  );
}

/** Courbes mensuelles (≤ 3 séries) avec réticule et info-bulle partagée. */
export function Lines({ labels, series, height = 190 }: { labels: string[]; series: { name: string; color: string; values: number[] }[]; height?: number }) {
  const { ref: box, width } = useWidth<HTMLDivElement>();
  const tip = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 26, r: 34, t: 10, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(2, ...series.flatMap((s) => s.values));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const x = (i: number) => pad.l + (labels.length > 1 ? (i / (labels.length - 1)) * w : w / 2);
  const y = (v: number) => pad.t + h - (v / top) * h;
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - pad.l) / w) * (labels.length - 1));
    const idx = Math.max(0, Math.min(labels.length - 1, i));
    setHover(idx);
    tip.show(e, (
      <div className="space-y-0.5">
        <div className="font-semibold text-slate-900">{labels[idx]}</div>
        {series.map((s) => <TipRow key={s.name} color={s.color} label={s.name} value={s.values[idx]} />)}
      </div>
    ));
  };
  return (
    <div ref={box} className="w-full">
      <div ref={tip.ref} className="relative">
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => { setHover(null); tip.hide(); }} role="img" aria-label={series.map((s) => s.name).join(', ')}>
          {[0, 1, 2, 3, 4].map((k) => (
            <g key={k}>
              <line x1={pad.l} x2={pad.l + w} y1={y(k * step)} y2={y(k * step)} stroke={k ? '#EEF2F6' : '#CBD5E1'} />
              <text x={pad.l - 6} y={y(k * step) + 3.5} textAnchor="end" fontSize="10" fill="#64748B">{k * step}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % 2 === labels.length % 2 || labels.length <= 6 ? (
            <text key={l} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="#64748B">{l}</text>
          ) : null))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="#94A3B8" strokeDasharray="3 3" />}
          {series.map((s) => (
            <g key={s.name}>
              <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
              {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />}
              <text x={x(labels.length - 1) + 6} y={y(s.values[s.values.length - 1]) + 3.5} fontSize="10" fontWeight="600" fill="#334155">{s.name}</text>
            </g>
          ))}
        </svg>
        {tip.node}
      </div>
    </div>
  );
}

/** Barres divergentes autour de zéro (ex. glissement en jours : retard à droite, avance à gauche). */
export function Diverging({ rows, colors, unit, tooltip }: {
  rows: { id: number | string; label: string; value: number }[];
  colors: { neg: string; pos: string };
  unit: string;
  tooltip: (r: { label: string; value: number }) => ReactNode;
}) {
  const tip = useTip();
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div ref={tip.ref} className="relative space-y-2" onMouseLeave={tip.hide}>
      {rows.map((r) => {
        const pct = (Math.abs(r.value) / max) * 40; // marge pour l’étiquette
        return (
          <div key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-2 sm:grid-cols-[minmax(0,13rem)_1fr]" onMouseMove={(e) => tip.show(e, tooltip(r))}>
            <div className="truncate text-xs font-medium text-slate-800" title={r.label}>{r.label}</div>
            <div className="relative h-5">
              <div className="absolute inset-y-[-3px] left-1/2 w-px bg-slate-400" />
              {r.value !== 0 && (
                <div
                  className={`absolute inset-y-0 ${r.value > 0 ? 'rounded-r' : 'rounded-l'}`}
                  style={{ background: r.value > 0 ? colors.pos : colors.neg, width: `${pct}%`, left: r.value > 0 ? '50%' : `${50 - pct}%` }}
                />
              )}
              <span
                className="absolute top-0.5 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-700"
                style={r.value >= 0 ? { left: `calc(${50 + pct}% + 4px)` } : { right: `calc(${50 + pct}% + 4px)` }}
              >
                {r.value > 0 ? '+' : ''}{r.value} {unit}
              </span>
            </div>
          </div>
        );
      })}
      {tip.node}
    </div>
  );
}
