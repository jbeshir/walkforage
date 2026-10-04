// Local-time helpers: day boundaries for the step ledger and formatting for step sync messages.

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Local midnight at the start of the day containing `ms`. */
export function localDayStart(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** The first local midnight after `ms` (23 or 25 hours after the previous one across DST). */
export function nextLocalMidnight(ms: number): number {
  const date = new Date(ms);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

/** "14:05" */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** "Mon 28 Sep" (word order follows the locale) */
export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Mon 28 Sep 14:05" */
export function formatDayTime(ms: number): string {
  return `${formatDay(ms)} ${formatTime(ms)}`;
}

/** "today", "yesterday" or the day, for the local day containing `ms`. */
export function relativeDay(ms: number, nowMs: number): string {
  const today = localDayStart(nowMs);
  const day = localDayStart(ms);
  if (day === today) return 'today';
  // Noon of the previous day is in yesterday whatever the DST change.
  if (day === localDayStart(today - 12 * HOUR_MS)) return 'yesterday';
  return formatDay(ms);
}

/** "just now", "5 min ago", "at 14:05" (earlier today) or "Mon 28 Sep 14:05" */
export function formatSyncAge(syncedAt: number, nowMs: number): string {
  const age = nowMs - syncedAt;
  if (age < MINUTE_MS) return 'just now';
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)} min ago`;
  if (localDayStart(syncedAt) === localDayStart(nowMs)) return `at ${formatTime(syncedAt)}`;
  return formatDayTime(syncedAt);
}
