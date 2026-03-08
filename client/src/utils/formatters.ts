type DateFormat = 'short' | 'long' | 'numeric';

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount);
}

export function formatDate(isoStr: string | undefined | null, format: DateFormat = 'short'): string {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  const options: Intl.DateTimeFormatOptions =
    format === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Intl.DateTimeFormat('it-IT', options).format(date);
}

export function formatDuration(minutes: number | undefined | null): string {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
