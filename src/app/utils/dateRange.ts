import { parseISODateLocal } from './date.ts';

function formatDisplayDate(value?: string | null): string {
  if (!value) return 'No date';
  const date = parseISODateLocal(value);
  if (!date) return value;
  return date.toLocaleDateString('en-CA');
}

export function formatDateRangeLabel(startDate?: string | null, endDate?: string | null): string {
  const startLabel = formatDisplayDate(startDate || undefined);
  const endLabel = formatDisplayDate(endDate || undefined);

  if (!startDate && !endDate) return 'No date';
  if (!startDate || startDate === endDate) return endLabel;
  if (!endDate) return startLabel;
  return `${startLabel} to ${endLabel}`;
}
