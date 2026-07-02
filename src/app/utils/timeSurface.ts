export interface TimeSurfaceRange {
  start: Date;
  end: Date;
}

export interface TimeSurfaceMarker {
  index: number;
  left: number;
  center: number;
}

export interface BuildDateRangeOptions {
  includeToday?: boolean;
  today?: Date;
  padStartDays?: number;
  padEndDays?: number;
  fallbackStartOffsetDays?: number;
  fallbackEndOffsetDays?: number;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetweenLocal(start: Date, end: Date): number {
  return Math.round((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / 86400000);
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export function buildDateRangeFromDates(
  dates: Date[],
  options: BuildDateRangeOptions = {}
): TimeSurfaceRange {
  const {
    includeToday = true,
    today = new Date(),
    padStartDays = 0,
    padEndDays = 0,
    fallbackStartOffsetDays = 0,
    fallbackEndOffsetDays = 0,
  } = options;

  const normalizedDates = dates
    .filter(date => date instanceof Date && !Number.isNaN(date.getTime()))
    .map(startOfLocalDay);
  const hasSourceDates = normalizedDates.length > 0;
  const normalizedToday = startOfLocalDay(today);

  if (includeToday) {
    normalizedDates.push(normalizedToday);
  }

  if (!hasSourceDates) {
    return {
      start: addCalendarDays(normalizedToday, fallbackStartOffsetDays),
      end: addCalendarDays(normalizedToday, fallbackEndOffsetDays),
    };
  }

  const min = new Date(Math.min(...normalizedDates.map(date => date.getTime())));
  const max = new Date(Math.max(...normalizedDates.map(date => date.getTime())));

  return {
    start: addCalendarDays(min, -padStartDays),
    end: addCalendarDays(max, padEndDays),
  };
}

export function buildDateSequence(range: TimeSurfaceRange): Date[] {
  const days = Math.max(1, daysBetweenLocal(range.start, range.end) + 1);
  return Array.from({ length: days }, (_, index) => addCalendarDays(range.start, index));
}

export function getFixedDaySurfaceMarker(
  rangeStart: Date,
  dayCount: number,
  dayWidth: number,
  date: Date
): TimeSurfaceMarker | null {
  const index = daysBetweenLocal(rangeStart, startOfLocalDay(date));
  if (index < 0 || index >= dayCount) return null;

  const left = index * dayWidth;
  return {
    index,
    left,
    center: left + (dayWidth / 2),
  };
}

export function findNearestVisibleDateIndex(
  dates: Date[],
  targetDate: Date
): number {
  if (dates.length === 0) return -1;

  const target = startOfLocalDay(targetDate).getTime();
  const exactIndex = dates.findIndex(date => startOfLocalDay(date).getTime() === target);
  if (exactIndex >= 0) return exactIndex;

  for (let index = 0; index < dates.length; index += 1) {
    if (startOfLocalDay(dates[index]).getTime() >= target) return index;
  }

  return dates.length - 1;
}

export function getVariableDaySurfaceMarker(
  dayWidths: number[],
  index: number,
  fallbackDayWidth: number
): TimeSurfaceMarker | null {
  if (index < 0 || index >= dayWidths.length) return null;

  const left = dayWidths.slice(0, index).reduce((total, width) => total + width, 0);
  const width = dayWidths[index] ?? fallbackDayWidth;

  return {
    index,
    left,
    center: left + (width / 2),
  };
}

export function getCenteredScrollLeftForMarker(
  markerCenter: number,
  viewportWidth: number
): number {
  return Math.max(0, markerCenter - (viewportWidth / 2));
}
