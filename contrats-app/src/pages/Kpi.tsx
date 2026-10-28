import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, FileText, Gavel, ShieldAlert, Stamp, TriangleAlert, Zap } from 'lucide-react';
import { api, type Rec } from '../api';
import { ChartCard, Columns, Diverging, Legend, Lines, NEUTRAL, RISK_RAMP, SERIES, StackedRows, TipRow } from '../components/charts';
import { Empty, Stat, toastError } from '../components/ui';
import { fmtDate, fmtMoney, fmtMonth, fmtNumber } from '../format';
import { t } from '../i18n';

const THEMES = [
  { id: 'all', label: 'Vue d’ensemble' },
  { id: 'finance', label: 'Finances' },
  { id: 'risks', label: 'Revue et risques' },
  { id: 'nec', label: 'Early Warnings et CE' },
  { id: 'deadlines', label: 'Échéances' },
  { id: 'visas', label: 'Visas' },
  { id: 'planning', label: 'Planning' },
];
const LEVELS = ['faible', 'moyen', 'élevé', 'critique', 'non_évalué'] as const;
const LEVEL_LABEL: Record<string, string> = { faible: 'Faible', moyen: 'Moyen', élevé: 'Élevé', critique: 'Critique', non_évalué: 'Non évalué' };
const VISA_COLOR: Record<string, string> = { 'en attente': SERIES[1], VSO: SERIES[0], VAO: SERIES[2], refusé: '#6E0D12', 'sans objet': '#94A3B8' };

export function Kpi() {
  const [contracts, setContracts] = useState<Rec[]>([]);
  const [contractId, setContractId] = useState('');
  const [theme, setTheme] = useState('all');
  const [data, setData] = useState<Rec | null>(null);

  useEffect(() => {
    api.get<Rec[]>('/api/contracts').then(setContracts).catch(toastError);
  }, []);
  useEffect(() => {
    setData(null);
    api.get<Rec>(`/api/kpis${contractId ? `?contract_id=${contractId}` : ''}`).then(setData).catch(toastError);
  }, [contractId]);

  const show = (id: string) => theme === 'all' || theme === id;
  const tl = data?.tiles;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">{t('KPI & graphiques')}</h1>
        <select className="input !w-auto" value={contractId} onChange={(e) => setContractId(e.target.value)} aria-label={t('Contrat')}>
          <option value="">{t('Tous les contrats')}</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>{c.reference ? `${c.reference} – ` : ''}{c.title}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {THEMES.map((th) => (
          <button
            key={th.id}
            role="tab"
            aria-selected={theme === th.id}
            onClick={() => setTheme(th.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${theme === th.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300'}`}
          >
            {t(th.label)}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="text-sm text-slate-500">{t('Chargement…')}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Stat label={t('Contrats actifs')} value={tl.active_contracts} icon={<FileText size={18} />} />
            <Stat label={t('Échéances dépassées')} value={tl.overdue} tone={tl.overdue ? 'red' : 'emerald'} icon={<AlertOctagon size={18} />} />
            <Stat label={t('Risques élevés ou critiques')} value={tl.high_risks} tone={tl.high_risks ? 'amber' : 'slate'} icon={<TriangleAlert size={18} />} />
            <Stat label={t('Early Warnings ouverts')} value={tl.open_ew} icon={<ShieldAlert size={18} />} />
            <Stat label={t('CE ouverts · exposition {amount}', { amount: fmtMoney(tl.ce_exposure) })} value={tl.open_ce} icon={<Zap size={18} />} />
            <Stat label={t('Visas en attente · {n} en retard', { n: tl.late_visas })} value={tl.pending_visas} tone={tl.late_visas ? 'amber' : 'slate'} icon={<Stamp size={18} />} />
            <Stat label={t('Réclamations en cours')} value={tl.claims_open} icon={<Gavel size={18} />} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {show('finance') && <FinanceChart rows={data.finance} />}
            {show('risks') && <RiskChart rows={data.risks} />}
            {show('nec') && <EwCeChart rows={data.monthly} />}
            {show('deadlines') && <DeadlineChart rows={data.deadlines} />}
            {show('visas') && <VisaChart rows={data.visas} />}
            {show('planning') && <PlanningChart rows={data.schedule} />}
          </div>
        </>
      )}
    </div>
  );
}

function FinanceChart({ rows }: { rows: Rec[] }) {
  const parts = [
    { key: 'paid', label: t('Payé'), color: SERIES[0] },
    { key: 'outstanding', label: t('Facturé, non payé'), color: SERIES[1] },
    { key: 'remaining', label: t('Reste à facturer'), color: NEUTRAL },
  ];
  return (
    <ChartCard
      title={t('Avancement financier par contrat')}
      subtitle={t('En % du montant actualisé (initial + avenants signés + CE implémentés)')}
      legend={<Legend items={parts} />}
      table={{
        head: [t('Contrat'), t('Montant actualisé'), t('Payé'), t('Facturé, non payé'), t('Reste à facturer'), t('Écart / initial')],
        rows: rows.map((r) => [r.title, fmtMoney(r.current, r.currency), fmtMoney(r.paid, r.currency), fmtMoney(r.outstanding, r.currency), fmtMoney(r.remaining, r.currency), r.variation_percent == null ? '—' : `${fmtNumber(r.variation_percent, 1)} %`]),
      }}
    >
      {rows.length ? (
        <StackedRows
          max={100}
          rows={rows.map((r) => ({
            id: r.id,
            label: r.title,
            sub: fmtMoney(r.current, r.currency),
            total: `${fmtNumber(r.progress_percent ?? 0)} %`,
            segments: parts.map((p) => ({ ...p, value: r.current ? (Math.max(0, r[p.key]) / r.current) * 100 : 0 })),
          }))}
          tooltip={(row, seg) => {
            const r = rows.find((x) => x.title === row.label)!;
            return (
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900">{row.label}</div>
                {parts.map((p) => <TipRow key={p.key} color={p.color} label={p.label} value={`${fmtMoney(r[p.key], r.currency)} · ${fmtNumber(r.current ? (r[p.key] / r.current) * 100 : 0)} %`} />)}
                <div className="pt-0.5 text-[11px] text-slate-500">{t('Survol : {label}', { label: seg.label })}</div>
              </div>
            );
          }}
        />
      ) : (
        <Empty>{t('Renseignez le montant des contrats et les situations de paiement pour voir ce graphique.')}</Empty>
      )}
    </ChartCard>
  );
}

function RiskChart({ rows }: { rows: Rec[] }) {
  const used = LEVELS.filter((l) => rows.some((r) => r[l] > 0));
  return (
    <ChartCard
      title={t('Revue de contrat : risques par thème')}
      subtitle={t('Points non clos, par niveau de risque')}
      legend={<Legend items={used.map((l) => ({ label: t(LEVEL_LABEL[l]), color: RISK_RAMP[l] }))} />}
      table={{ head: [t('Thème'), ...LEVELS.map((l) => t(LEVEL_LABEL[l])), t('Total')], rows: rows.map((r) => [r.theme, ...LEVELS.map((l) => r[l]), r.total]) }}
    >
      {rows.length ? (
        <StackedRows
          rows={rows.map((r) => ({
            id: r.theme,
            label: r.theme,
            total: r.total,
            segments: LEVELS.map((l) => ({ key: l, label: t(LEVEL_LABEL[l]), color: RISK_RAMP[l], value: r[l] })),
          }))}
          tooltip={(row) => (
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-900">{row.label}</div>
              {row.segments.filter((s) => s.value).map((s) => <TipRow key={s.key} color={s.color} label={s.label} value={s.value} />)}
            </div>
          )}
        />
      ) : (
        <Empty>{t('Aucun point de revue ouvert. Importez ou générez la revue de contrat.')}</Empty>
      )}
    </ChartCard>
  );
}

function EwCeChart({ rows }: { rows: Rec[] }) {
  const series = [
    { name: 'EW', color: SERIES[0], values: rows.map((r) => r.ew) },
    { name: 'CE', color: SERIES[1], values: rows.map((r) => r.ce) },
  ];
  const total = series.reduce((s, x) => s + x.values.reduce((a, b) => a + b, 0), 0);
  return (
    <ChartCard
      title={t('Early Warnings et Compensation Events notifiés')}
      subtitle={t('Par mois, sur 12 mois glissants')}
      legend={<Legend items={[{ label: 'Early Warnings', color: SERIES[0] }, { label: 'Compensation Events', color: SERIES[1] }]} />}
      table={{ head: [t('Mois'), 'EW', 'CE'], rows: rows.map((r) => [fmtMonth(r.month), r.ew, r.ce]) }}
    >
      {total ? <Lines labels={rows.map((r) => fmtMonth(r.month))} series={series} /> : <Empty>{t('Aucun Early Warning ni Compensation Event sur les 12 derniers mois.')}</Empty>}
    </ChartCard>
  );
}

function DeadlineChart({ rows }: { rows: Rec[] }) {
  const data = rows.map((r) => ({ key: r.month, label: r.month === 'overdue' ? t('En retard') : fmtMonth(r.month), value: r.count }));
  return (
    <ChartCard
      title={t('Échéances à venir')}
      subtitle={t('Échéances dépassées, puis par mois sur 6 mois')}
      table={{ head: [t('Mois'), t('Échéances')], rows: data.map((d) => [d.label, d.value]) }}
    >
      <Columns
        data={data}
        color={SERIES[0]}
        highlight={(k) => (k === 'overdue' ? '#B3000C' : undefined)}
        tooltip={(d) => <TipRow label={d.label} value={t('{n} échéance(s)', { n: d.value })} />}
      />
      <div className="mt-2 text-right text-xs">
        <Link className="text-brand-700 hover:underline" to="/echeances">{t('Ouvrir l’échéancier')} →</Link>
      </div>
    </ChartCard>
  );
}

function VisaChart({ rows }: { rows: Rec[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const segs = rows.map((r) => ({ key: r.status, label: t(r.status), value: r.count, color: VISA_COLOR[r.status] }));
  return (
    <ChartCard
      title={t('Circuit de visa : statut des documents')}
      subtitle={t('{n} document(s) soumis au visa', { n: total })}
      legend={<Legend items={segs.filter((s) => s.value)} />}
      table={{ head: [t('Avis'), t('Documents'), '%'], rows: rows.map((r) => [t(r.status), r.count, total ? `${fmtNumber((r.count / total) * 100)} %` : '—']) }}
    >
      {total ? (
        <StackedRows
          rows={[{ id: 'visas', label: t('Tous les documents'), total, segments: segs }]}
          tooltip={(_, s) => <TipRow color={s.color} label={s.label} value={`${s.value} · ${fmtNumber((s.value / total) * 100)} %`} />}
        />
      ) : (
        <Empty>{t('Aucun document dans le circuit de visa.')}</Empty>
      )}
    </ChartCard>
  );
}

function PlanningChart({ rows }: { rows: Rec[] }) {
  return (
    <ChartCard
      title={t('Glissement de l’achèvement prévu')}
      subtitle={t('Dernier planning importé comparé à la date contractuelle (jours)')}
      legend={<Legend items={[{ label: t('En avance'), color: SERIES[0] }, { label: t('Retard'), color: SERIES[1] }]} />}
      table={{ head: [t('Contrat'), t('Date contractuelle'), t('Fin prévue'), t('Écart (j)')], rows: rows.map((r) => [r.title, fmtDate(r.contract_end), fmtDate(r.planned_completion), r.slip_days]) }}
    >
      {rows.length ? (
        <Diverging
          rows={rows.map((r) => ({ id: r.id, label: r.title, value: r.slip_days }))}
          colors={{ neg: SERIES[0], pos: SERIES[1] }}
          unit={t('j')}
          tooltip={(r) => {
            const s = rows.find((x) => x.title === r.label)!;
            return (
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900">{r.label}</div>
                <TipRow label={t('Date contractuelle')} value={fmtDate(s.contract_end)} />
                <TipRow label={t('Fin prévue')} value={fmtDate(s.planned_completion)} />
                <TipRow label={t('Écart')} value={`${r.value > 0 ? '+' : ''}${r.value} ${t('j')}`} />
              </div>
            );
          }}
        />
      ) : (
        <Empty>{t('Importez un planning (MS Project, P6, Excel) pour suivre le glissement.')}</Empty>
      )}
    </ChartCard>
  );
}
