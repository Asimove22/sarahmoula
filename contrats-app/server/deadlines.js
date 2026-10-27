// Calcul des échéances contractuelles (NEC3/NEC4 et contrats français).
// Les dates sont manipulées au format ISO 'YYYY-MM-DD', sans heure.

export function addDays(iso, days) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const CE_CLOSED = new Set(['implémenté', 'rejeté', 'retiré']);
const NEC = new Set(['NEC3', 'NEC4']);
const CONTRACT_CLOSED = "('clôturé', 'résilié', 'archivé')";

/**
 * Dates dérivées d'un Compensation Event selon les délais du contrat
 * (par défaut : notification 8 sem. cl. 61.3, réponse PM 1 sem. cl. 61.4,
 * devis 3 sem. et réponse PM au devis 2 sem. cl. 62.3).
 */
export function ceDerived(ce, contract) {
  const w = (n, dflt) => (n ?? dflt) * 7;
  const notifyDeadline = ce.date_aware ? addDays(ce.date_aware, w(contract.ce_notify_weeks, 8)) : null;
  return {
    notify_deadline: notifyDeadline,
    time_barred_risk: Boolean(
      notifyDeadline && ce.notified_by === 'Entrepreneur' &&
      ((ce.date_notified && ce.date_notified > notifyDeadline) || (!ce.date_notified && today() > notifyDeadline)),
    ),
    pm_reply_due: ce.date_notified && !ce.pm_reply_date ? addDays(ce.date_notified, w(contract.pm_reply_weeks, 1)) : null,
    quotation_due:
      ce.quotation_instructed_date && !ce.quotation_submitted_date
        ? addDays(ce.quotation_instructed_date, w(contract.quote_weeks, 3))
        : null,
    pm_quote_reply_due:
      ce.quotation_submitted_date && !ce.pm_quote_reply_date
        ? addDays(ce.quotation_submitted_date, w(contract.pm_quote_reply_weeks, 2))
        : null,
  };
}

/** Liste de toutes les échéances ouvertes, triées par date. */
export function computeDeadlines(db, { contractId } = {}) {
  const where = contractId ? 'WHERE c.id = ?' : '';
  const args = contractId ? [Number(contractId)] : [];
  const contracts = db.prepare(`SELECT * FROM contracts c ${where}`).all(...args);
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const items = [];
  const push = (contract, item) => {
    if (!item.date) return;
    items.push({ ...item, contract_id: contract.id, contract_title: contract.title, contract_reference: contract.reference });
  };

  for (const c of contracts) {
    if (['clôturé', 'résilié', 'archivé', 'brouillon'].includes(c.status)) continue;
    if (c.end_date) {
      push(c, { date: c.end_date, kind: 'contrat', entity: 'contracts', entity_id: c.id, title: 'Fin du contrat' });
      if (c.notice_period_days) {
        push(c, {
          date: addDays(c.end_date, -c.notice_period_days),
          kind: 'contrat',
          entity: 'contracts',
          entity_id: c.id,
          title: c.tacit_renewal ? 'Date limite de dénonciation (reconduction tacite)' : 'Date limite de préavis',
          critical: true,
        });
      }
    }
    if (c.completion_date && NEC.has(c.framework)) {
      push(c, { date: c.completion_date, kind: 'contrat', entity: 'contracts', entity_id: c.id, title: 'Completion Date' });
    }
  }

  const rows = (table, cond) =>
    db
      .prepare(`SELECT t.* FROM ${table} t JOIN contracts c ON c.id = t.contract_id ${where ? `${where} AND` : 'WHERE'} c.status NOT IN ${CONTRACT_CLOSED} AND ${cond}`)
      .all(...args);

  for (const ew of rows('early_warnings', "t.status = 'ouvert' AND t.next_review_date IS NOT NULL")) {
    push(byId.get(ew.contract_id), {
      date: ew.next_review_date,
      kind: 'early_warning',
      entity: 'early_warnings',
      entity_id: ew.id,
      title: `${ew.number ?? 'EW'} – revue : ${ew.title}`,
    });
  }

  for (const ce of rows('compensation_events', '1 = 1')) {
    if (CE_CLOSED.has(ce.status)) continue;
    const contract = byId.get(ce.contract_id);
    const d = ceDerived(ce, contract);
    const base = { kind: 'compensation_event', entity: 'compensation_events', entity_id: ce.id };
    const label = `${ce.number ?? 'CE'} ${ce.title}`;
    if (!ce.date_notified && d.notify_deadline && ce.notified_by === 'Entrepreneur') {
      push(contract, { ...base, date: d.notify_deadline, title: `${label} – limite de notification (forclusion)`, critical: true });
    }
    if (d.pm_reply_due) push(contract, { ...base, date: d.pm_reply_due, title: `${label} – réponse du PM attendue` });
    if (d.quotation_due) push(contract, { ...base, date: d.quotation_due, title: `${label} – remise du devis`, critical: true });
    if (d.pm_quote_reply_due) push(contract, { ...base, date: d.pm_quote_reply_due, title: `${label} – réponse du PM au devis` });
  }

  for (const m of rows('correspondence', 't.response_required = 1 AND t.response_date IS NULL AND t.response_due IS NOT NULL')) {
    push(byId.get(m.contract_id), {
      date: m.response_due,
      kind: 'correspondence',
      entity: 'correspondence',
      entity_id: m.id,
      title: `Réponse à « ${m.subject} »${m.reference ? ` (${m.reference})` : ''}`,
    });
  }

  for (const ms of rows('milestones', 't.actual_date IS NULL')) {
    push(byId.get(ms.contract_id), {
      date: ms.forecast_date || ms.planned_date,
      kind: 'milestone',
      entity: 'milestones',
      entity_id: ms.id,
      title: ms.title,
    });
  }

  const now = today();
  return items
    .map((i) => ({ ...i, overdue: i.date < now }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
