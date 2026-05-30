import { BANGKOK_OFFSET_MIN } from '../domain/booking-rules';

/**
 * Build a UTC `Date` for a given Asia/Bangkok calendar date (YYYY-MM-DD) and
 * minutes-from-midnight. Bangkok is a fixed UTC+7 offset, so the conversion is a
 * simple subtraction — no DST tables needed.
 */
export function bangkokDateTimeToUtc(date: string, minutesOfDay: number): Date {
  const [y, m, d] = date.split('-').map((n) => Number(n));
  const utcMidnightOfBangkokDay = Date.UTC(y, m - 1, d, 0, 0, 0) - BANGKOK_OFFSET_MIN * 60_000;
  return new Date(utcMidnightOfBangkokDay + minutesOfDay * 60_000);
}

/** Validate a YYYY-MM-DD string and that it denotes a real calendar date. */
export function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
