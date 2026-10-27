export function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : iso;
}

export function fmtDateTime(value?: string | null) {
  if (!value) return '—';
  return `${fmtDate(value)} ${value.slice(11, 16)}`;
}

export function fmtMoney(amount?: number | null, currency = 'EUR') {
  if (amount === null || amount === undefined) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(amount);
  } catch {
    return `${amount.toLocaleString('fr-FR')} ${currency}`;
  }
}

export function fmtSize(bytes?: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
}

/** Nombre de jours entre aujourd'hui et la date (négatif = passé). */
export function daysFromToday(iso: string) {
  const a = Date.parse(`${todayIso()}T00:00:00Z`);
  const b = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function relativeDays(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n > 0) return `dans ${n} j`;
  return `retard ${-n} j`;
}
