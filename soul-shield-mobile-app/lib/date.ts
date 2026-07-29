function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, amount: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + amount);
  return toISODate(date);
}

export function todayISODate(): string {
  return toISODate(new Date());
}

export function isToday(iso: string): boolean {
  return iso === todayISODate();
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdayIndex(iso: string): number {
  return fromISODate(iso).getDay();
}

export function weekdayLabel(index: number): string {
  return WEEKDAY_LABELS[index];
}

export function formatDisplayDate(iso: string): string {
  if (isToday(iso)) return `Today, ${formatMonthDay(iso)}`;
  const yesterday = addDays(todayISODate(), -1);
  if (iso === yesterday) return `Yesterday, ${formatMonthDay(iso)}`;
  return formatMonthDay(iso);
}

function formatMonthDay(iso: string): string {
  const date = fromISODate(iso);
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function monthShortLabel(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, { month: 'short' });
}

/** Inclusive list of ISO dates from `from` to `to`. */
export function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}
