import { useCallback, useEffect, useState } from 'react';
import { api, type Rec } from '../../api';
import { RegisterPanel } from '../../components/RegisterPanel';
import { Badge, SubTabs, toastError } from '../../components/ui';
import { AMENDMENT_FIELDS, PAYMENT_FIELDS } from '../../schemas';
import { daysFromToday, fmtDate, fmtMoney, relativeDays, todayIso } from '../../format';

export function FinanceSummary({ contract, refreshKey = 0, compact }: { contract: Rec; refreshKey?: number; compact?: boolean }) {
  const [f, setF] = useState<Rec | null>(null);
  useEffect(() => {
    api.get<Rec>(`/api/contracts/${contract.id}/finance`).then(setF).catch(toastError);
  }, [contract.id, refreshKey]);
  if (!f) return null;
  const m = (n: number) => fmtMoney(n, f.currency);
  const cards: [string, string, string?][] = [
    ['Montant initial', m(f.initial)],
    ['Avenants signés', m(f.amendments_signed), f.amendments_pending ? `+ ${m(f.amendments_pending)} en négociation` : undefined],
    ['CE implémentés', m(f.ce_implemented), f.ce_exposure ? `${m(f.ce_exposure)} chiffrés en cours` : undefined],
    ['Montant actualisé', m(f.current), f.variation_percent !== null ? `${f.variation_percent >= 0 ? '+' : ''}${f.variation_percent.toFixed(1)} % · ${f.extra_days} j de délai en plus` : undefined],
    ['Facturé (validé)', m(f.invoiced)],
    ['Payé', m(f.paid), f.outstanding ? `${m(f.outstanding)} en attente` : undefined],
    ['Reste à facturer', m(f.remaining_to_invoice)],
    ['Retenue de garantie', m(f.retention)],
  ];
  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
        {(compact ? [cards[3], cards[4], cards[5], cards[6]] : cards).map(([label, value, hint]) => (
          <div key={label} className="card p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            {hint && <div className="text-xs text-slate-400">{hint}</div>}
          </div>
        ))}
      </div>
      {f.progress_percent !== null && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Avancement financier</span>
            <span>{f.progress_percent.toFixed(1)} %</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-slate-200">
            <div className="h-full bg-indigo-600" style={{ width: `${Math.min(f.progress_percent, 100)}%` }} />
          </div>
        </div>
      )}
      {f.overdue_payments > 0 && <p className="text-sm font-medium text-red-600">{f.overdue_payments} paiement(s) en retard.</p>}
    </div>
  );
}

export function FinanceTab({ contract, openId, entity, onChange }: { contract: Rec; openId?: number; entity?: string; onChange: () => void }) {
  const [sub, setSub] = useState(entity === 'amendments' ? 'avenants' : 'situations');
  const [refreshKey, setRefreshKey] = useState(0);
  const changed = useCallback(() => {
    setRefreshKey((k) => k + 1);
    onChange();
  }, [onChange]);
  const m = (n?: number | null) => fmtMoney(n, contract.currency);

  return (
    <div className="space-y-4">
      <FinanceSummary contract={contract} refreshKey={refreshKey} />
      <SubTabs value={sub} onChange={setSub} tabs={[{ id: 'situations', label: 'Situations / demandes de paiement' }, { id: 'avenants', label: 'Avenants' }]} />
      {sub === 'situations' ? (
        <RegisterPanel
          table="payments"
          contractId={contract.id}
          title="Situations de travaux"
          addLabel="Nouvelle situation"
          emptyText="Enregistrez vos demandes de paiement : l’échéance est calculée avec le délai de paiement du contrat et les retards sont signalés."
          fields={PAYMENT_FIELDS}
          defaults={{ status: 'soumise', submitted_date: todayIso() }}
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
            { key: 'status', label: 'Statut', render: (r) => <Badge value={r.status} /> },
          ]}
        />
      ) : (
        <RegisterPanel
          table="amendments"
          contractId={contract.id}
          title="Avenants"
          addLabel="Nouvel avenant"
          emptyText="Aucun avenant. Archivez aussi le document signé dans la GED (catégorie « Avenant »)."
          fields={AMENDMENT_FIELDS}
          defaults={{ status: 'en négociation' }}
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
