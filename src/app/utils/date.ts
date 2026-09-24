export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODateLocal(value?: string | null): Date | null {
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

export type TimelineKeyboardDateAction = 'move' | 'resize-start' | 'resize-end';

export function updateTimelineDateRangeByKeyboard(
  startDateISO: string | undefined,
  endDateISO: string | undefined,
  action: TimelineKeyboardDateAction,
  direction: -1 | 1,
  showWeekends: boolean,
): { startDate: string; endDate: string } | null {
  const startDate = parseISODateLocal(startDateISO);
  if (!startDate) return null;
  const endDate = parseISODateLocal(endDateISO) ?? new Date(startDate);

  const shiftVisibleDay = (date: Date) => {
    const shifted = new Date(date);
    do shifted.setDate(shifted.getDate() + direction);
    while (!showWeekends && (shifted.getDay() === 0 || shifted.getDay() === 6));
    return shifted;
  };

  if (action === 'move') {
    const nextStart = shiftVisibleDay(startDate);
    const calendarDelta = nextStart.getTime() - startDate.getTime();
    return {
      startDate: toLocalISODate(nextStart),
      endDate: toLocalISODate(new Date(endDate.getTime() + calendarDelta)),
    };
  }

  if (action === 'resize-start') {
    const nextStart = shiftVisibleDay(startDate);
    if (nextStart > endDate) return null;
    return { startDate: toLocalISODate(nextStart), endDate: toLocalISODate(endDate) };
  }

  const nextEnd = shiftVisibleDay(endDate);
  if (nextEnd < startDate) return null;
  return { startDate: toLocalISODate(startDate), endDate: toLocalISODate(nextEnd) };
}

export interface TaskDateFields {
  startDate?: string;
  endDate?: string;
}

/**
 * Returns the range a task occupies on the Timeline, or null when the task is
 * intentionally unscheduled. A missing end date follows the existing one-day
 * policy (end = start); an unparseable or inverted range is not schedulable.
 */
export function getScheduledDateRange(task: TaskDateFields): { start: Date; end: Date } | null {
  const start = parseISODateLocal(task.startDate);
  if (!start) return null;
  if (!task.endDate) return { start, end: start };
  const end = parseISODateLocal(task.endDate);
  if (!end || end < start) return null;
  return { start, end };
}

export function hasScheduledDateRange(task: TaskDateFields): boolean {
  return getScheduledDateRange(task) !== null;
}

/**
 * Normalizes task-editor date input for persistence. Both dates empty keeps the
 * task unscheduled; a single date becomes a one-day range instead of being
 * padded with today.
 */
export function normalizeTaskDateRangeForSave(startDate: string, endDate: string): TaskDateFields {
  const start = startDate.trim() || undefined;
  const end = endDate.trim() || undefined;
  return { startDate: start ?? end, endDate: end ?? start };
}
