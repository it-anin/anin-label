/**
 * Format Date as DD/MM/YY in Buddhist Era (BE = AD + 543).
 * Matches the date shown on the BIGYA reference label, e.g. "11/03/69".
 */
export function formatBeDate(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const beYY = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  return `${dd}/${mm}/${beYY}`;
}
