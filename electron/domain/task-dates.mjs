// Shared calendar-date semantics for renderer Timeline and main-process projections.
export function parseISODateLocal(value) {
  if (!value) return null;
  const trimmed = value.trim();

  // Treat canonical YYYY-MM-DD values as local calendar dates (not UTC timestamps).
  const localIsoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (localIsoMatch) {
    const year = Number(localIsoMatch[1]);
    const month = Number(localIsoMatch[2]) - 1;
    const day = Number(localIsoMatch[3]);
    const date = new Date(year, month, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Returns the range a task occupies on the Timeline, or null when the task is
 * intentionally unscheduled. A missing end date follows the existing one-day
 * policy (end = start); an unparseable or inverted range is not schedulable.
 */
export function getScheduledDateRange(task) {
  const start = parseISODateLocal(task.startDate);
  if (!start) return null;
  if (!task.endDate) return { start, end: start };
  const end = parseISODateLocal(task.endDate);
  if (!end || end < start) return null;
  return { start, end };
}

export function hasScheduledDateRange(task) {
  return getScheduledDateRange(task) !== null;
}
