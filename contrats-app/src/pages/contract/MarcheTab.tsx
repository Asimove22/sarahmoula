import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Scale } from 'lucide-react';
import { api, type Rec } from '../../api';
import { RegisterPanel } from '../../components/RegisterPanel';
import { Badge, SubTabs, toastError } from '../../components/ui';
import { BUYER_TYPES, CCAG_OPTIONS, CLAIM_FIELDS, SERVICE_ORDER_FIELDS, SUBCONTRACTOR_FIELDS } from '../../schemas';
import { addDaysIso, daysFromToday, fmtDate, fmtMoney, relativeDays, todayIso } from '../../format';
import { t } from '../../i18n';

function DueCell({ date, done }: { date?: string | null; done?: string | null }) {
  if (done) return <span className="text-emerald-700">{t('fait le {date}', { date: fmtDate(done) })}</span>;
  if (!date) return <>—</>;
  const n = daysFromToday(date);
  return (
    <span className={n < 0 ? 'font-medium text-red-600' : n <= 5 ? 'font-medium text-amber-700' : ''}>
      {fmtDate(date)} <span className="text-xs">({relativeDays(date)})</span>
    </span>
  );
}

const addMonthsIso = (iso: string, m: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + m);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};

/** Marché public : référentiel (CCP, CCAG 2021), ordres de service, réclamations, sous-traitance, décompte. */
export function MarcheTab({ contract, openId, entity, onChange }: { contract: Rec; openId?: number; entity?: string; onChange: () => void }) {
  const [sub, setSub] = useState(entity === 'claims' ? 'reclamations' : entity === 'subcontractors' ? 'sous-traitants' : entity === 'service_orders' ? 'os' : 'referentiel');
  return (
    <div className="space-y-4">
      <SubTabs
        value={sub}
        onChange={setSub}
        tabs={[
          { id: 'referentiel', label: t('Référentiel juridique') },
          { id: 'os', label: t('Ordres de service') },
          { id: 'reclamations', label: t('Réclamations') },
          { id: 'sous-traitants', label: t('Sous-traitants') },
          { id: 'decompte', label: t('Réception et décompte') },
        ]}
      />
      {sub === 'referentiel' && <Referential contract={contract} />}
      {sub === 'os' && (
        <RegisterPanel
          table="service_orders"
          contractId={contract.id}
          title={t('Registre des ordres de service')}
          addLabel={t('Enregistrer un OS')}
          emptyText={t('Enregistrez chaque ordre de service reçu : le délai de 15 jours pour émettre des réserves est suivi automatiquement.')}
          fields={SERVICE_ORDER_FIELDS}
          defaults={{ status: 'reçu', received_date: todayIso() }}
          openId={entity === 'service_orders' ? openId : undefined}
          onChange={onChange}
          rowClassName={(r) => (r.overdue ? 'bg-red-50' : '')}
          columns={[
            { key: 'number', label: 'N°', className: 'whitespace-nowrap font-medium' },
            { key: 'title', label: 'Objet', render: (r) => <>{r.title}<div className="text-xs text-slate-400">{t(r.kind ?? '')}</div></> },
            { key: 'received_date', label: 'Reçu', render: (r) => fmtDate(r.received_date || r.issued_date), className: 'whitespace-nowrap' },
            { key: 'impact', label: 'Incidence', render: (r) => [r.amount != null && fmtMoney(r.amount, contract.currency), r.extra_days && `${r.extra_days} j`].filter(Boolean).join(' · ') || '—', className: 'whitespace-nowrap' },
            { key: 'reserves', label: 'Réserves avant', render: (r) => (r.status === 'reçu' ? <DueCell date={r.computed_reserves_due} done={r.reserves_date} /> : r.reserves_date ? <DueCell done={r.reserves_date} /> : '—'), className: 'whitespace-nowrap' },
            { key: 'status', label: 'Statut', render: (r) => <Badge value={r.status} /> },
          ]}
        />
      )}
      {sub === 'reclamations' && (
        <RegisterPanel
          table="claims"
          contractId={contract.id}
          title={t('Différends et mémoires en réclamation')}
          addLabel={t('Nouveau différend')}
          emptyText={t('Dès qu’un différend apparaît, enregistrez-le : le délai de 2 mois pour transmettre le mémoire en réclamation est suivi, puis le délai de réponse de l’acheteur (silence = rejet).')}
          fields={CLAIM_FIELDS}
          defaults={{ status: 'différend', dispute_date: todayIso() }}
          openId={entity === 'claims' ? openId : undefined}
          onChange={onChange}
          columns={[
            { key: 'number', label: 'N°', className: 'whitespace-nowrap font-medium' },
            { key: 'title', label: 'Objet' },
            { key: 'dispute_date', label: 'Différend', render: (r) => fmtDate(r.dispute_date), className: 'whitespace-nowrap' },
            { key: 'memo', label: 'Mémoire avant', render: (r) => <DueCell date={r.computed_memo_due} done={r.memo_sent_date} />, className: 'whitespace-nowrap' },
            { key: 'response', label: 'Réponse avant', render: (r) => (r.memo_sent_date ? <DueCell date={r.computed_response_due} done={r.response_date} /> : '—'), className: 'whitespace-nowrap' },
            { key: 'amount', label: 'Réclamé / obtenu', render: (r) => `${fmtMoney(r.amount_claimed, contract.currency)}${r.amount_obtained != null ? ` / ${fmtMoney(r.amount_obtained, contract.currency)}` : ''}`, className: 'whitespace-nowrap' },
            { key: 'status', label: 'Statut', render: (r) => <Badge value={r.status} /> },
          ]}
        />
      )}
      {sub === 'sous-traitants' && (
        <RegisterPanel
          table="subcontractors"
          contractId={contract.id}
          title={t('Sous-traitants')}
          addLabel={t('Déclarer un sous-traitant')}
          emptyText={t('Déclarez chaque sous-traitant (DC4). Il ne peut intervenir qu’après acceptation et agrément de ses conditions de paiement.')}
          fields={SUBCONTRACTOR_FIELDS}
          defaults={{ status: 'en cours d’agrément', direct_payment: 1 }}
          openId={entity === 'subcontractors' ? openId : undefined}
          onChange={onChange}
          columns={[
            { key: 'company', label: 'Entreprise', className: 'font-medium' },
            { key: 'scope', label: 'Prestations', render: (r) => <span className="line-clamp-2 text-xs">{r.scope ?? '—'}</span> },
            { key: 'amount_ht', label: 'Montant HT', render: (r) => fmtMoney(r.amount_ht, contract.currency), className: 'whitespace-nowrap' },
            {
              key: 'direct',
              label: 'Paiement direct',
              render: (r) =>
                r.direct_payment ? t('oui') : r.direct_payment_required ? <span className="flex items-center gap-1 text-red-600"><AlertTriangle size={13} /> {t('obligatoire')}</span> : t('non'),
            },
            { key: 'approval_date', label: 'Agrément', render: (r) => (r.approval_date ? fmtDate(r.approval_date) : <span className="text-amber-700">{t('en attente')}</span>) },
            { key: 'status', label: 'Statut', render: (r) => <Badge value={r.status} /> },
          ]}
        />
      )}
      {sub === 'decompte' && <FinalAccount contract={contract} />}
    </div>
  );
}

function Referential({ contract }: { contract: Rec }) {
  const [rules, setRules] = useState<Rec[]>([]);
  useEffect(() => {
    api.get(`/api/contracts/${contract.id}/legal`).then(setRules).catch(toastError);
  }, [contract.id]);
  const ccag = CCAG_OPTIONS.find((o) => o.value === contract.ccag)?.label;
  const buyer = BUYER_TYPES.find((o) => o.value === contract.buyer_type)?.label;
  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <Scale size={18} className="text-brand-600" /> {t('Marché public')}
        </span>
        <span>
          <span className="text-slate-500">{t('CCAG')} : </span>
          {ccag ? t(ccag) : <span className="text-amber-700">{t('non renseigné')}</span>}
        </span>
        <span>
          <span className="text-slate-500">{t('Acheteur')} : </span>
          {buyer ? t(buyer) : <span className="text-amber-700">{t('non renseigné')}</span>}
        </span>
        <span>
          <span className="text-slate-500">{t('Procédure')} : </span>
          {contract.procedure ? t(contract.procedure) : '—'}
        </span>
        <span>
          <span className="text-slate-500">{t('Notifié le')} : </span>
          {fmtDate(contract.notification_date)}
        </span>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">{t('Thème')}</th>
              <th className="th">{t('Règle')}</th>
              <th className="th">{t('Ce qui s’applique')}</th>
              <th className="th">{t('Source')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((r, i) => (
              <tr key={i}>
                <td className="td whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-brand-700">{r.theme}</td>
                <td className="td font-medium">{r.title}</td>
                <td className="td">{r.value}</td>
                <td className="td text-xs text-slate-500">
                  <span className="flex items-start gap-1">
                    <BookOpen size={12} className="mt-0.5 shrink-0" /> {t(r.source)}
                  </span>
                  {r.verify && <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">{t('à vérifier dans le CCAP')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        {t('Référentiel indicatif : le CCAP prime sur le CCAG pour toutes les stipulations auxquelles il déroge expressément (liste des dérogations en fin de CCAP). Les règles du Code de la commande publique sont d’ordre public. En cas d’enjeu, faites valider par un juriste.')}
      </p>
    </div>
  );
}

/** Chronologie réception → décompte final → décompte général → garanties. */
function FinalAccount({ contract: c }: { contract: Rec }) {
  const works = c.ccag === 'TRAVAUX_2021';
  const steps: { label: string; date?: string | null; due?: string | null; note?: string }[] = [
    { label: t('Réception'), date: c.reception_date, note: t('Point de départ des garanties et du décompte') },
    ...(works ? [{ label: t('Projet de décompte final transmis'), date: c.final_account_sent_date, due: c.reception_date ? addDaysIso(c.reception_date, 30) : null, note: t('Délai indicatif : 30 jours après la réception (CCAG Travaux 2021, art. 12 – à vérifier)') }] : []),
    { label: t('Décompte général notifié'), date: c.dgd_notified_date },
    { label: t('Décompte général retourné signé'), date: c.dgd_signed_date, due: c.dgd_notified_date ? addDaysIso(c.dgd_notified_date, 30) : null, note: c.dgd_reserves ? t('Retourné avec réserves') : t('30 jours, sinon réputé accepté') },
    ...(works && c.reception_date
      ? [
          { label: t('Fin de la garantie de parfait achèvement'), date: null, due: addDaysIso(c.reception_date, 365), note: t('Un an après la réception') },
          { label: t('Remboursement de la retenue de garantie'), date: null, due: addMonthsIso(addDaysIso(c.reception_date, 365), 1), note: t('Au plus tard un mois après la fin de la garantie (CCP, art. R2191-35)') },
          { label: t('Fin de la garantie biennale'), date: null, due: addDaysIso(c.reception_date, 730) },
          { label: t('Fin de la garantie décennale'), date: null, due: addDaysIso(c.reception_date, 3652) },
        ]
      : []),
  ];
  return (
    <div className="card p-4">
      <p className="mb-3 text-sm text-slate-500">{t('Renseignez les dates dans la fiche contrat (Modifier → Décompte).')}</p>
      <ol className="relative space-y-4 border-l-2 border-brand-200 pl-5">
        {steps.map((s, i) => {
          const done = Boolean(s.date);
          const late = !done && s.due && s.due < todayIso();
          return (
            <li key={i} className="relative">
              <span className={`absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 ${done ? 'border-emerald-600 bg-emerald-500' : late ? 'border-red-600 bg-red-500' : 'border-brand-300 bg-white'}`} />
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs text-slate-500">
                {done ? t('le {date}', { date: fmtDate(s.date) }) : s.due ? <DueCell date={s.due} /> : t('à venir')}
                {s.note && <span> · {s.note}</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
