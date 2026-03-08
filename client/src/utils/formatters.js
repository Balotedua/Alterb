/**
 * Formatta un numero come valuta (default EUR).
 * @param {number} amount
 * @param {string} currency
 */
export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount);
}

/**
 * Formatta una stringa ISO in data leggibile.
 * @param {string} isoStr
 * @param {'short'|'long'|'numeric'} format
 */
export function formatDate(isoStr, format = 'short') {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  const options = format === 'long'
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Intl.DateTimeFormat('it-IT', options).format(date);
}

/**
 * Formatta una durata in minuti → "Xh Ym".
 * @param {number} minutes
 */
export function formatDuration(minutes) {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
