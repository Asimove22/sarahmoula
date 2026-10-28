import { CopyPlus } from 'lucide-react';
import { api, type Rec } from '../../api';
import { RegisterPanel } from '../../components/RegisterPanel';
import { Badge, toast, toastError } from '../../components/ui';
import { SUBMITTAL_FIELDS } from '../../schemas';
import { daysFromToday, fmtDate, relativeDays, todayIso } from '../../format';
import { t } from '../../i18n';

/** Circuit de visa : transmission, délai de visa, avis (VSO / VAO / refusé), indices successifs. */
export function VisasTab({ contract, openId, onChange, onOpen }: { contract: Rec; openId?: number; onChange: () => void; onOpen: (id: number) => void }) {
  return (
    <RegisterPanel
      table="submittals"
      contractId={contract.id}
      title={t('Circuit de visa')}
      addLabel="Transmettre un document"
      emptyText={t('Enregistrez chaque document transmis pour visa (plans EXE, notes de calcul, fiches techniques…). Délai de visa : {n} jours (modifiable dans la fiche contrat).', { n: contract.visa_days ?? 15 })}
      fields={SUBMITTAL_FIELDS}
      defaults={{ revision: 'A', visa_status: 'en attente', submitted_date: todayIso() }}
      docLink="submittal_id"
      docCategory="Visa / Document technique"
      openId={openId}
      onChange={onChange}
      rowClassName={(r) => (r.overdue ? 'bg-red-50' : '')}
      formFooter={(s, close) =>
        ['refusé', 'VAO'].includes(s.visa_status) ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                const next = await api.post(`/api/submittals/${s.id}/revision`, {});
                toast(t('Indice {rev} créé : déposez le document mis à jour', { rev: next.revision }));
                close();
                onChange();
                onOpen(next.id);
              } catch (e) {
                toastError(e);
              }
            }}
          >
            <CopyPlus size={16} /> {t('Nouvel indice')}
          </button>
        ) : null
      }
      columns={[
        { key: 'number', label: 'N°', className: 'whitespace-nowrap font-medium' },
        { key: 'revision', label: 'Ind.' },
        { key: 'title', label: 'Document', render: (r) => <>{r.title}{r.documents_count > 0 && <div className="text-xs text-slate-400">{r.documents_count} {t('fichier(s)')}</div>}</> },
        { key: 'discipline', label: 'Lot' },
        { key: 'reviewer', label: 'Viseur' },
        { key: 'submitted_date', label: 'Transmis', render: (r) => fmtDate(r.submitted_date), className: 'whitespace-nowrap' },
        {
          key: 'due',
          label: 'Visa attendu',
          className: 'whitespace-nowrap',
          render: (r) =>
            r.visa_status !== 'en attente' ? (
              `visé ${fmtDate(r.visa_date)}`
            ) : r.computed_visa_due ? (
              <span className={daysFromToday(r.computed_visa_due) < 0 ? 'font-medium text-red-600' : ''}>
                {fmtDate(r.computed_visa_due)} <span className="text-xs">({relativeDays(r.computed_visa_due)})</span>
              </span>
            ) : (
              '—'
            ),
        },
        { key: 'visa_status', label: 'Avis', render: (r) => <Badge value={r.visa_status} /> },
      ]}
    />
  );
}
