const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Bangkok',
});

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});

/** Format an ISO instant as a Bangkok-local HH:mm string. */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** Format an ISO instant as a Bangkok-local date string. */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatTHB(amount: number): string {
  return amount === 0 ? 'Free' : `฿${amount.toLocaleString('en-US')}`;
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday] ?? String(weekday);
}

/** Minutes-from-midnight -> HH:mm. */
export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** HH:mm -> minutes-from-midnight. Returns null on invalid input. */
export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) return null;
  return h * 60 + m;
}

/** Today's date as YYYY-MM-DD in Asia/Bangkok. */
export function todayBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}
