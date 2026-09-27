export interface TaskDateFields { startDate?: string; endDate?: string; }
export function parseISODateLocal(value?: string | null): Date | null;
export function getScheduledDateRange(task: TaskDateFields): {start: Date; end: Date} | null;
export function hasScheduledDateRange(task: TaskDateFields): boolean;
