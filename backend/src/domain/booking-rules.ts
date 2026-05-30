/**
 * Pure booking rules — no database, no I/O. These are unit-tested in isolation and
 * reused by the API layer. Time intervals are treated as half-open `[start, end)`
 * so that a booking ending exactly when the next one starts does NOT count as an
 * overlap (back-to-back appointments are allowed).
 */

export interface Interval {
  start: Date;
  end: Date;
}

/** Asia/Bangkok is a fixed UTC+7 offset with no daylight-saving time. */
export const BANGKOK_OFFSET_MIN = 7 * 60;

/** Two half-open intervals `[start, end)` overlap when each starts before the other ends. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * Minutes-from-midnight (Asia/Bangkok) for a UTC instant.
 * Returns a value in `[0, 1440)`.
 */
export function bangkokMinutesOfDay(at: Date): number {
  const shifted = at.getTime() + BANGKOK_OFFSET_MIN * 60_000;
  const mins = Math.floor(shifted / 60_000) % 1440;
  return ((mins % 1440) + 1440) % 1440;
}

/** Weekday (0 = Sunday .. 6 = Saturday) of a UTC instant, evaluated in Asia/Bangkok. */
export function bangkokWeekday(at: Date): number {
  const shifted = new Date(at.getTime() + BANGKOK_OFFSET_MIN * 60_000);
  return shifted.getUTCDay();
}

/**
 * True when the whole interval sits within the given open/close window (minutes from
 * midnight, Asia/Bangkok) on a single day. Bookings that span midnight are rejected.
 */
export function withinBusinessHours(
  interval: Interval,
  openMin: number,
  closeMin: number,
): boolean {
  const startDay = bangkokWeekday(interval.start);
  const endInclusive = new Date(interval.end.getTime() - 1);
  if (bangkokWeekday(endInclusive) !== startDay) return false;

  const startMin = bangkokMinutesOfDay(interval.start);
  const durationMin = Math.round((interval.end.getTime() - interval.start.getTime()) / 60_000);
  const endMin = startMin + durationMin;
  return startMin >= openMin && endMin <= closeMin;
}

/** True when the instant is at or before `now` (cannot book the past). */
export function isInPast(at: Date, now: Date = new Date()): boolean {
  return at.getTime() <= now.getTime();
}

/** True when `at` is at least `leadMinutes` ahead of `now`. */
export function meetsLeadTime(at: Date, leadMinutes: number, now: Date = new Date()): boolean {
  return at.getTime() - now.getTime() >= leadMinutes * 60_000;
}

/**
 * Generate candidate slot start-minutes for a day. Slots are spaced by `durationMin`
 * and the last slot must finish at or before `closeMin`.
 */
export function generateSlots(openMin: number, closeMin: number, durationMin: number): number[] {
  if (durationMin <= 0) return [];
  const slots: number[] = [];
  for (let start = openMin; start + durationMin <= closeMin; start += durationMin) {
    slots.push(start);
  }
  return slots;
}

/**
 * Remove candidate intervals that overlap any already-booked interval.
 * Inputs and outputs are concrete `Interval`s so the caller controls the date math.
 */
export function subtractBooked(candidates: Interval[], booked: Interval[]): Interval[] {
  return candidates.filter((c) => !booked.some((b) => overlaps(c, b)));
}
