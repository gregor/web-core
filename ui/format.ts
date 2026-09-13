// Formatters are built once: constructing an Intl formatter is far slower than using
// one, and these run per table cell.
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const eurWhole = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const numberFormats = new Map<string, Intl.NumberFormat>();
const date = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** 1234.5 → "1.234,50 €"; with `{ whole: true }` → "1.235 €". */
export function formatEUR(value: number, { whole = false }: { whole?: boolean } = {}): string {
  return (whole ? eurWhole : eur).format(value);
}

/** German grouping and decimals: formatNumber(1234.5, 2) → "1.234,50". */
export function formatNumber(value: number, fractionDigits?: number): string {
  const id = String(fractionDigits);
  let format = numberFormats.get(id);
  if (!format) {
    format = new Intl.NumberFormat(
      'de-DE',
      fractionDigits === undefined
        ? undefined
        : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits },
    );
    numberFormats.set(id, format);
  }
  return format.format(value);
}

/**
 * "2026-09-13" or a Date → "13.09.2026". A bare ISO date is read as a local calendar
 * day, not as UTC midnight, which would show the previous day west of Greenwich.
 */
export function formatDateDE(value: string | Date): string {
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    value = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  }
  return date.format(value);
}
