import { useCallback, useEffect, useState } from 'react';
import { api, type Rec } from '../../api';
import { RegisterPanel } from '../../components/RegisterPanel';
import { Badge, SubTabs, toastError } from '../../components/ui';
import { AGREEMENT_TYPES, AMENDMENT_FIELDS, ORDER_FIELDS, PAYMENT_FIELDS } from '../../schemas';
import { daysFromToday, fmtDate, fmtMoney, relativeDays, todayIso } from '../../format';
import { t } from '../../i18n';
import { RevisionPanel } from './RevisionPanel';

export function FinanceSummary({ contract, refreshKey = 0, compact }: { contract: Rec; refreshKey?: number; compact?: boolean }) {
  const [f, setF] = useState<Rec | null>(null);
  useEffect(() => {
    api.get<Rec>(`/api/contracts/${contract.id}/finance`).then(setF).catch(toastError);
  }, [contract.id, refreshKey]);
  if (!f) return null;
  const m = (n: number) => fmtMoney(n, f.currency);
  const cards: [string, string, string?][] = [
    ['Montant initial', m(f.initial)],
    ['Avenants signés', m(f.amendments_signed), f.amendments_pending ? t('+ {amount} en négociation', { amount: m(f.amendments_pending) }) : undefined],
    ['CE implémentés', m(f.ce_implemented), f.ce_exposure ? t('{amount} chiffrés en cours', { amount: m(f.ce_exposure) }) : undefined],
    ['Montant actualisé', m(f.current), f.variation_percent !== null ? `${f.variation_percent >= 0 ? '+' : ''}${f.variation_percent.toFixed(1)} % · ${t('{n} j de délai en plus', { n: f.extra_days })}` : undefined],
    ['Facturé (validé)', m(f.invoiced)],
    ['Payé', m(f.paid), f.outstanding ? t('{amount} en attente', { amount: m(f.outstanding) }) : undefined],
    ['Reste à facturer', m(f.remaining_to_invoice)],
    ['Retenue de garantie', m(f.retention)],
  ];
  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
        {(compact ? [cards[3], cards[4], cards[5], cards[6]] : cards).map(([label, value, hint]) => (
          <div key={label} className="card p-3">
            <div className="text-xs text-slate-500">{t(label)}</div>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            {hint && <div className="text-xs text-slate-400">{hint}</div>}
          </div>
        ))}
      </div>
      {f.progress_percent !== null && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{t('Avancement financier')}</span>
            <span>{f.progress_percent.toFixed(1)} %</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-slate-200">
            <div className="h-full bg-brand-600" style={{ width: `${Math.min(f.progress_percent, 100)}%` }} />
          </div>
        </div>
      )}
      {f.overdue_payments > 0 && <p className="text-sm font-medium text-red-600">{f.overdue_payments} {t('paiement(s) en retard.')}</p>}
    </div>
  );
}

export function FinanceTab({ contract, openId, entity, onChange }: { contract: Rec; openId?: number; entity?: string; onChange: () => void }) {
  const [sub, setSub] = useState(entity === 'amendments' ? 'avenants' : entity === 'orders' ? 'commandes' : 'situations');
  const [refreshKey, setRefreshKey] = useState(0);
  const changed = useCallback(() => {
    setRefreshKey((k) => k + 1);
    onChange();
  }, [onChange]);
  const m = (n?: number | null) => fmtMoney(n, contract.currency);

  return (
    <div className="space-y-4">
      <FinanceSummary contract={contract} refreshKey={refreshKey} />
      <SubTabs
        value={sub}
        onChange={setSub}
        tabs={[
          { id: 'situations', label: 'Situations / demandes de paiement' },
          { id: 'avenants', label: 'Avenants' },
          ...(contract.agreement_type ? [{ id: 'commandes', label: 'Bons de commande / marchés subséquents' }] : []),
          { id: 'revision', label: 'Révision des prix' },
        ]}
      />
      {sub === 'commandes' && <OrdersPanel contract={contract} refreshKey={refreshKey} onChange={changed} openId={entity === 'orders' ? openId : undefined} />}
      {sub === 'revision' && <RevisionPanel contract={contract} refreshKey={refreshKey} onChange={changed} />}
      {sub === 'situations' && (
        <RegisterPanel
          table="payments"
          contractId={contract.id}
          title={t('Situations de travaux')}
          addLabel="Nouvelle situation"
          emptyText="Enregistrez vos demandes de paiement : l’échéance est calculée avec le délai de paiement du contrat et les retards sont signalés."
          fields={PAYMENT_FIELDS}
          defaults={{ status: 'soumise', submitted_date: todayIso() }}
          docLink="payment_id"
          docCategory="Facture / Situation"
          importDocs="Déposez des factures ou situations (PDF, Excel…) : n°, date, période et montants HT/TTC sont lus automatiquement"
          openId={entity === 'payments' ? openId : undefined}
          onChange={changed}
          rowClassName={(r) => (r.overdue ? 'bg-red-50' : '')}
          columns={[
            { key: 'number', label: 'N°', className: 'whitespace-nowrap font-medium' },
            { key: 'period', label: 'Période' },
            { key: 'submitted_date', label: 'Remise', render: (r) => fmtDate(r.submitted_date), className: 'whitespace-nowrap' },
            { key: 'amount_requested', label: 'Demandé', render: (r) => m(r.amount_requested), className: 'whitespace-nowrap text-right' },
            { key: 'amount_validated', label: 'Validé', render: (r) => m(r.amount_validated), className: 'whitespace-nowrap text-right' },
            {
              key: 'due',
              label: 'Échéance',
              className: 'whitespace-nowrap',
              render: (r) =>
                r.paid_date ? (
                  `payée ${fmtDate(r.paid_date)}`
                ) : r.computed_due_date ? (
                  <span className={daysFromToday(r.computed_due_date) < 0 ? 'font-medium text-red-600' : ''}>
                    {fmtDate(r.computed_due_date)} <span className="text-xs">({relativeDays(r.computed_due_date)})</span>
                  </span>
                ) : (
                  '—'
                ),
            },
            { key: 'amount_paid', label: 'Payé', render: (r) => m(r.amount_paid), className: 'whitespace-nowrap text-right' },
            ...(contract.framework === 'FR_PUBLIC'
              ? [
                  {
                    key: 'late_interest',
                    label: 'Intérêts moratoires',
                    className: 'whitespace-nowrap text-right',
                    render: (r: Rec) =>
                      r.late_interest ? (
                        <span className="text-red-700" title={`${r.late_interest.days} j · ${r.late_interest.rate ?? '?'} % + 40 €`}>
                          {r.late_interest.interest != null ? m(r.late_interest.interest + r.late_interest.flat_fee) : t('? (taux BCE)')}
                        </span>
                      ) : (
                        '—'
                      ),
                  },
                ]
              : []),
            { key: 'status', label: 'Statut', render: (r) => <Badge value={r.status} /> },
          ]}
        />
      )}
      {sub === 'avenants' && (
        <RegisterPanel
          table="amendments"
          contractId={contract.id}
          title={t('Avenants')}
          addLabel="Nouvel avenant"
          emptyText="Aucun avenant. Archivez aussi le document signé dans la GED (catégorie « Avenant »)."
          fields={AMENDMENT_FIELDS}
          defaults={{ status: 'en négociation' }}
          docLink="amendment_id"
          docCategory="Avenant"
          importDocs="Déposez des avenants ou projets d’avenant (PDF, Word…) : un avenant est créé par fichier"
          openId={entity === 'amendments' ? openId : undefined}
          onChange={changed}
          columns={[
            { key: 'number', label: 'N°', className: 'whitespace-nowrap font-medium' },
            { key: 'title', label: 'Objet' },
            { key: 'signature_date', label: 'Signé le', render: (r) => fmtDate(r.signature_date), className: 'whitespace-nowrap' },
            { key: 'amount', label: 'Montant', render: (r) => m(r.amount), className: 'whitespace-nowrap text-right' },
            { key: 'extra_days', label: 'Délai', render: (r) => (r.extra_days ? `${r.extra_days > 0 ? '+' : ''}${r.extra_days} j` : '—') },
            { key: 'status', label: 'Statut', render: (r) => <Badge value={r.status} /> },
          ]}
        />
      )}
    </div>
  );
}

/** Accord-cadre : consommation du maximum et registre des bons de commande / marchés subséquents. */
function OrdersPanel({ contract, refreshKey, onChange, openId }: { contract: Rec; refreshKey: number; onChange: () => void; openId?: number }) {
  const [s, setS] = useState<Rec | null>(null);
  useEffect(() => {
    api.get<Rec>(`/api/contracts/${contract.id}/agreement`).then(setS).catch(toastError);
  }, [contract.id, refreshKey]);
  const m = (n?: number | null) => fmtMoney(n, contract.currency);
  const pct = s?.consumption_percent ?? null;
  return (
    <RegisterPanel
      table="orders"
      contractId={contract.id}
      title={t(AGREEMENT_TYPES.find((a) => a.value === contract.agreement_type)?.label ?? 'Bons de commande')}
      addLabel="Nouveau bon de commande"
      emptyText="Enregistrez chaque bon de commande ou marché subséquent : Clausia suit la consommation du maximum et les délais d’exécution."
      fields={ORDER_FIELDS}
      defaults={{ status: 'émis', issued_date: todayIso(), kind: contract.agreement_type === 'marches_subsequents' ? 'marché subséquent' : 'bon de commande' }}
      docLink="order_id"
      docCategory="Pièce jointe"
      importDocs="Déposez des bons de commande (PDF, Word, Excel…) : un bon est créé par fichier, avec le montant lu et le document joint"
      openId={openId}
      onChange={onChange}
      rowClassName={(r) => (r.status !== 'annulé' && r.due_date && r.due_date < todayIso() && ['émis', 'en cours'].includes(r.status) ? 'bg-red-50' : '')}
      topContent={
        s && (
          <div className="card grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs text-slate-500">{t('Engagé')}</div>
              <div className="text-lg font-semibold tabular-nums">{m(s.committed)}</div>
              <div className="text-xs text-slate-400">{t('{n} commande(s)', { n: s.orders })}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t('Minimum')}</div>
              <div className="text-lg font-semibold tabular-nums">{s.min ? m(s.min) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t('Maximum')}</div>
              <div className="text-lg font-semibold tabular-nums">{s.max ? m(s.max) : '—'}</div>
              {s.remaining !== null && <div className="text-xs text-slate-400">{t('reste {amount}', { amount: m(s.remaining) })}</div>}
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>{t('Consommation du maximum')}</span>
                <span className="tabular-nums">{pct !== null ? `${pct.toFixed(0)} %` : '—'}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-200">
                <div className={`h-full ${pct !== null && pct >= 100 ? 'bg-red-700' : pct !== null && pct >= 80 ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} />
              </div>
            </div>
          </div>
        )
      }
      columns={[
        { key: 'number', label: 'N°', className: 'whitespace-nowrap font-medium' },
        { key: 'title', label: 'Objet', render: (r) => <>{r.title}<div className="text-xs text-slate-400">{t(r.kind ?? '')}</div></> },
        { key: 'issued_date', label: 'Émis le', render: (r) => fmtDate(r.issued_date), className: 'whitespace-nowrap' },
        { key: 'due_date', label: 'Fin prévue', render: (r) => fmtDate(r.due_date), className: 'whitespace-nowrap' },
        { key: 'amount', label: 'Montant', render: (r) => m(r.amount), className: 'whitespace-nowrap text-right' },
        { key: 'status', label: 'Statut', render: (r) => <Badge value={r.status} /> },
      ]}
    />
  );
}
