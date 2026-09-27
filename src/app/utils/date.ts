import { parseISODateLocal } from '../../../electron/domain/task-dates.mjs';
import type { TaskDateFields } from '../../../electron/domain/task-dates.mjs';
export { parseISODateLocal, getScheduledDateRange, hasScheduledDateRange } from '../../../electron/domain/task-dates.mjs';
export type { TaskDateFields } from '../../../electron/domain/task-dates.mjs';

export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
