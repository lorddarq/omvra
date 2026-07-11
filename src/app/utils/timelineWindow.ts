import type { Task } from '../types.ts';
import { parseISODateLocal } from './date.ts';

export interface TimelineWindow {
  startDate: Date;
  endDate: Date;
}

export type TimelineWindowDirection = 'past' | 'future';

const PAD_DAYS = 7;
const MIN_TOTAL_MONTHS = 12;

const atStartOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const atEndOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

export function createInitialTimelineWindow(tasks: Task[], referenceDate = new Date()): TimelineWindow {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const taskDates = tasks.flatMap(task => [task.startDate, task.endDate]
    .map(parseISODateLocal)
    .filter((date): date is Date => date !== null));

  const earliest = taskDates.length > 0
    ? new Date(Math.min(...taskDates.map(date => date.getTime())))
    : today;
  const latest = taskDates.length > 0
    ? new Date(Math.max(...taskDates.map(date => date.getTime())))
    : today;
  latest.setDate(latest.getDate() + PAD_DAYS);

  const startDate = atStartOfMonth(earliest < today ? earliest : today);
  const minimumEnd = new Date(today.getFullYear(), today.getMonth() + MIN_TOTAL_MONTHS, 0);
  const endDate = atEndOfMonth(latest > minimumEnd ? latest : minimumEnd);

  return { startDate, endDate };
}

export function getTimelineWindowDates(window: TimelineWindow, showWeekends: boolean): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(window.startDate);

  while (cursor <= window.endDate) {
    const day = cursor.getDay();
    if (showWeekends || (day !== 0 && day !== 6)) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function extendTimelineWindow(
  window: TimelineWindow,
  direction: TimelineWindowDirection,
  months = 3
): TimelineWindow {
  if (direction === 'past') {
    return {
      startDate: new Date(window.startDate.getFullYear(), window.startDate.getMonth() - months, 1),
      endDate: window.endDate,
    };
  }

  return {
    startDate: window.startDate,
    endDate: atEndOfMonth(new Date(window.endDate.getFullYear(), window.endDate.getMonth() + months, 1)),
  };
}

export function extendTimelineWindowToDate(
  window: TimelineWindow,
  date: Date
): TimelineWindow {
  if (date < window.startDate) {
    return { startDate: atStartOfMonth(date), endDate: window.endDate };
  }

  if (date > window.endDate) {
    return { startDate: window.startDate, endDate: atEndOfMonth(date) };
  }

  return window;
}

export function getTimelineWindowAddedDayCount(
  window: TimelineWindow,
  direction: TimelineWindowDirection,
  showWeekends: boolean,
  months = 3
): number {
  const extendedWindow = extendTimelineWindow(window, direction, months);
  const addedRange = direction === 'past'
    ? { startDate: extendedWindow.startDate, endDate: new Date(window.startDate.getFullYear(), window.startDate.getMonth(), 0) }
    : { startDate: new Date(window.endDate.getFullYear(), window.endDate.getMonth() + 1, 1), endDate: extendedWindow.endDate };

  return getTimelineWindowDates(addedRange, showWeekends).length;
}

export function getTimelineWindowScrollCompensation(
  window: TimelineWindow,
  direction: TimelineWindowDirection,
  showWeekends: boolean,
  dayWidth: number,
  months = 3
): number {
  return getTimelineWindowAddedDayCount(window, direction, showWeekends, months) * dayWidth;
}
