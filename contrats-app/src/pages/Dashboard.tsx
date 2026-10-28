import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, CalendarPlus, FileText, Files, Mail, ShieldAlert, Stamp, Zap } from 'lucide-react';
import { api, type Rec } from '../api';
import { DeadlineList } from '../components/DeadlineList';
import { Insights } from '../components/Insights';
import { Stat, toastError } from '../components/ui';
import { ENTITY_LABELS } from '../schemas';
import { fmtDateTime } from '../format';
import { t } from '../i18n';

export function Dashboard() {
  const [data, setData] = useState<Rec | null>(null);
  useEffect(() => {
    api.get<Rec>('/api/dashboard').then(setData).catch(toastError);
  }, []);
  if (!data) return <div className="text-sm text-slate-500">{t('Chargement…')}</div>;
  const s = data.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">{t('Tableau de bord')}</h1>
        <a className="btn-secondary" href="/api/calendar.ics" title={t('Importer toutes les échéances dans Outlook ou Google Agenda')}>
          <CalendarPlus size={16} /> {t('Exporter vers mon agenda')}
        </a>
        <Link className="btn-primary" to="/contrats?nouveau=1">
          {t('+ Nouveau contrat')}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label={t('Contrats actifs')} value={s.active_contracts} icon={<FileText size={18} />} />
        <Stat label={t('Échéances dépassées')} value={s.overdue} tone={s.overdue ? 'red' : 'emerald'} icon={<AlertOctagon size={18} />} />
        <Stat label={t('Early Warnings ouverts')} value={s.open_early_warnings} tone={s.open_early_warnings ? 'amber' : 'slate'} icon={<ShieldAlert size={18} />} />
        <Stat label={t('Compensation Events en cours')} value={s.open_compensation_events} tone="slate" icon={<Zap size={18} />} />
        <Stat label={t('Réponses attendues')} value={s.pending_replies} tone={s.pending_replies ? 'amber' : 'slate'} icon={<Mail size={18} />} />
        <Stat label={t('Visas en attente')} value={s.pending_visas} icon={<Stamp size={18} />} />
        <Stat label={t('Documents archivés')} value={s.documents} icon={<Files size={18} />} />
      </div>

      <section className="card p-4">
        <h2 className="mb-1 font-semibold">
          {t('Points d’attention')}{' '}
          <span className="text-sm font-normal text-slate-500">
            ({data.insights.filter((i: Rec) => i.level === 'critique').length} {t('critiques,')} {data.insights.filter((i: Rec) => i.level === 'attention').length} {t('à surveiller)')}
          </span>
        </h2>
        <Insights items={data.insights} limit={10} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 font-semibold text-red-700">{t('En retard (')}{data.overdue.length})</h2>
          <DeadlineList items={data.overdue} empty="Rien en retard." />
        </section>
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">{t('30 prochains jours (')}{data.upcoming.length})</h2>
          <DeadlineList items={data.upcoming} empty="Aucune échéance dans les 30 jours." />
        </section>
      </div>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">{t('Activité récente')}</h2>
        {data.recent_activity.length === 0 ? (
          <p className="text-sm text-slate-500">
            {t('Aucune activité. Commencez par')} <Link className="text-brand-700 underline" to="/contrats?nouveau=1">{t('créer un contrat')}</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.recent_activity.map((j: Rec) => (
              <li key={j.id} className="flex gap-3 py-1.5">
                <span className="w-32 shrink-0 text-xs text-slate-400">{fmtDateTime(j.at)}</span>
                <span className="min-w-0 truncate">
                  <span className="text-slate-500">{t(ENTITY_LABELS[j.entity] ?? j.entity)} · {t(j.action)} :</span> {j.summary}
                  {j.contract_id && j.entity !== 'contracts' && (
                    <Link className="ml-1 text-xs text-brand-700 hover:underline" to={`/contrats/${j.contract_id}`}>
                      ({j.contract_title})
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
