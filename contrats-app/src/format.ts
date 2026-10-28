import { getLang, t } from './i18n';

/** Locale d'affichage des nombres et dates, selon la langue choisie. */
export const locale = () => (getLang() === 'en' ? 'en-GB' : 'fr-FR');

export function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!d) return iso;
  return getLang() === 'en' ? `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${y}` : `${d}/${m}/${y}`;
}

export function fmtDateTime(value?: string | null) {
  if (!value) return '—';
  return `${fmtDate(value)} ${value.slice(11, 16)}`;
}

export function fmtMoney(amount?: number | null, currency = 'EUR') {
  if (amount === null || amount === undefined) return '—';
  try {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: currency || 'EUR' }).format(amount);
  } catch {
    return `${amount.toLocaleString(locale())} ${currency}`;
  }
}

export function fmtSize(bytes?: number | null) {
  if (!bytes) return '—';
  const en = getLang() === 'en';
  if (bytes < 1024) return `${bytes} ${en ? 'B' : 'o'}`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} ${en ? 'KB' : 'Ko'}`;
  return `${(bytes / 1024 ** 2).toFixed(1)} ${en ? 'MB' : 'Mo'}`;
}

/** Nombre de jours entre aujourd'hui et la date (négatif = passé). */
export function daysFromToday(iso: string) {
  const a = Date.parse(`${todayIso()}T00:00:00Z`);
  const b = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function relativeDays(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return t("aujourd'hui");
  if (n === 1) return t('demain');
  if (n > 0) return t('dans {n} j', { n });
  return t('retard {n} j', { n: -n });
}

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Mois court « janv. 26 » / « Jan 26 » à partir de AAAA-MM. */
export function fmtMonth(ym: string) {
  return new Intl.DateTimeFormat(locale(), { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${ym}-01T00:00:00Z`));
}

export function fmtNumber(n: number, digits = 0) {
  return n.toLocaleString(locale(), { maximumFractionDigits: digits });
}
