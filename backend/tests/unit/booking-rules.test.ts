import { describe, it, expect } from 'vitest';
import {
  overlaps,
  withinBusinessHours,
  isInPast,
  meetsLeadTime,
  generateSlots,
  subtractBooked,
  bangkokMinutesOfDay,
  bangkokWeekday,
} from '../../src/domain/booking-rules';

const at = (iso: string) => new Date(iso);
const iv = (s: string, e: string) => ({ start: at(s), end: at(e) });

describe('overlaps (half-open intervals)', () => {
  it('detects a real overlap', () => {
    expect(overlaps(iv('2026-06-01T03:00:00Z', '2026-06-01T04:00:00Z'),
      iv('2026-06-01T03:30:00Z', '2026-06-01T04:30:00Z'))).toBe(true);
  });
  it('treats back-to-back as non-overlapping', () => {
    expect(overlaps(iv('2026-06-01T03:00:00Z', '2026-06-01T04:00:00Z'),
      iv('2026-06-01T04:00:00Z', '2026-06-01T05:00:00Z'))).toBe(false);
  });
  it('detects full containment', () => {
    expect(overlaps(iv('2026-06-01T03:00:00Z', '2026-06-01T06:00:00Z'),
      iv('2026-06-01T04:00:00Z', '2026-06-01T05:00:00Z'))).toBe(true);
  });
  it('is symmetric', () => {
    const a = iv('2026-06-01T03:00:00Z', '2026-06-01T04:00:00Z');
    const b = iv('2026-06-01T03:30:00Z', '2026-06-01T05:00:00Z');
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });
});

describe('bangkok helpers (UTC+7)', () => {
  it('converts UTC instant to minutes-of-day', () => {
    // 03:00Z == 10:00 Bangkok == 600 minutes.
    expect(bangkokMinutesOfDay(at('2026-06-01T03:00:00Z'))).toBe(600);
  });
  it('wraps across midnight correctly', () => {
    // 18:00Z == 01:00 next day Bangkok == 60 minutes.
    expect(bangkokMinutesOfDay(at('2026-06-01T18:00:00Z'))).toBe(60);
  });
  it('computes the local weekday', () => {
    // 2026-06-01 is a Monday; 17:30Z is 00:30 Tuesday in Bangkok.
    expect(bangkokWeekday(at('2026-06-01T17:30:00Z'))).toBe(2);
  });
});

describe('withinBusinessHours', () => {
  // Window 09:00–18:00 Bangkok == 540–1080.
  it('accepts a slot inside the window', () => {
    // 10:00–11:00 Bangkok == 03:00–04:00 UTC.
    expect(withinBusinessHours(iv('2026-06-01T03:00:00Z', '2026-06-01T04:00:00Z'), 540, 1080)).toBe(true);
  });
  it('accepts a slot ending exactly at close', () => {
    // 17:00–18:00 Bangkok == 10:00–11:00 UTC.
    expect(withinBusinessHours(iv('2026-06-01T10:00:00Z', '2026-06-01T11:00:00Z'), 540, 1080)).toBe(true);
  });
  it('rejects a slot starting before open', () => {
    // 08:00–09:00 Bangkok == 01:00–02:00 UTC.
    expect(withinBusinessHours(iv('2026-06-01T01:00:00Z', '2026-06-01T02:00:00Z'), 540, 1080)).toBe(false);
  });
  it('rejects a slot finishing after close', () => {
    // 17:30–18:30 Bangkok == 10:30–11:30 UTC.
    expect(withinBusinessHours(iv('2026-06-01T10:30:00Z', '2026-06-01T11:30:00Z'), 540, 1080)).toBe(false);
  });
});

describe('isInPast / meetsLeadTime', () => {
  const now = at('2026-06-01T00:00:00Z');
  it('flags past instants', () => {
    expect(isInPast(at('2026-05-31T23:59:00Z'), now)).toBe(true);
    expect(isInPast(at('2026-06-01T00:01:00Z'), now)).toBe(false);
  });
  it('enforces lead time', () => {
    expect(meetsLeadTime(at('2026-06-01T00:30:00Z'), 60, now)).toBe(false);
    expect(meetsLeadTime(at('2026-06-01T01:00:00Z'), 60, now)).toBe(true);
  });
});

describe('generateSlots', () => {
  it('packs slots by duration and stops at close', () => {
    // 09:00–10:30 with 30-min slots -> 540, 570, 600.
    expect(generateSlots(540, 630, 30)).toEqual([540, 570, 600]);
  });
  it('does not emit a slot that would run past close', () => {
    // 540..620 with 60-min duration -> only 540 (600 would end at 660 > 620... actually 600 fits? close 620)
    expect(generateSlots(540, 620, 60)).toEqual([540]);
  });
  it('returns nothing for non-positive duration', () => {
    expect(generateSlots(540, 1080, 0)).toEqual([]);
  });
});

describe('subtractBooked', () => {
  it('removes candidates overlapping a booked interval', () => {
    const candidates = [
      iv('2026-06-01T03:00:00Z', '2026-06-01T04:00:00Z'),
      iv('2026-06-01T04:00:00Z', '2026-06-01T05:00:00Z'),
      iv('2026-06-01T05:00:00Z', '2026-06-01T06:00:00Z'),
    ];
    const booked = [iv('2026-06-01T04:00:00Z', '2026-06-01T05:00:00Z')];
    const result = subtractBooked(candidates, booked);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.start.toISOString())).toEqual([
      '2026-06-01T03:00:00.000Z',
      '2026-06-01T05:00:00.000Z',
    ]);
  });
  it('keeps everything when nothing is booked', () => {
    const candidates = [iv('2026-06-01T03:00:00Z', '2026-06-01T04:00:00Z')];
    expect(subtractBooked(candidates, [])).toHaveLength(1);
  });
});
