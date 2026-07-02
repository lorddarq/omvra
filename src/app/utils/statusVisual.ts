import { getReadableTextClassFor } from './contrast.ts';
import type { StatusColumn, TaskStatus } from '../types.ts';

export interface StatusVisual {
  id: string;
  label: string;
  color: string;
  backgroundClassName?: string;
  backgroundStyle?: { backgroundColor: string };
  textClassName: string;
  progressPercent: number;
}

const STATUS_PROGRESS: Record<TaskStatus, number> = {
  open: 15,
  'in-progress': 45,
  'under-review': 80,
  done: 100,
};

const STATUS_FALLBACK_COLORS: Record<TaskStatus, string> = {
  open: '#d1d5db',
  'in-progress': '#3b82f6',
  'under-review': '#f59e0b',
  done: '#10b981',
};

const STATUS_COLOR_CLASS_TO_HEX: Record<string, string> = {
  'bg-cyan-500': '#06b6d4',
  'bg-blue-500': '#3b82f6',
  'bg-amber-500': '#f59e0b',
  'bg-orange-500': '#f97316',
  'bg-red-500': '#ef4444',
  'bg-emerald-500': '#10b981',
  'bg-green-500': '#22c55e',
  'bg-pink-500': '#ec4899',
  'bg-purple-500': '#a855f7',
  'bg-zinc-500': '#71717a',
  'bg-gray-500': '#6b7280',
  'bg-gray-300': '#d1d5db',
};

function isCssColor(value: string): boolean {
  return value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl');
}

function resolveStatusColumn(statusColumns: Array<Pick<StatusColumn, 'id' | 'title' | 'color'>>, status: string) {
  return statusColumns.find(column => column.id === status);
}

export function getStatusLabel(
  statusColumns: Array<Pick<StatusColumn, 'id' | 'title' | 'color'>>,
  status: string
): string {
  return resolveStatusColumn(statusColumns, status)?.title || status;
}

export function resolveStatusColor(status?: string, explicitColor?: string): string {
  if (explicitColor && isCssColor(explicitColor)) {
    return explicitColor;
  }

  if (explicitColor) {
    const mappedColor = STATUS_COLOR_CLASS_TO_HEX[explicitColor];
    if (mappedColor) return mappedColor;
  }

  switch ((status || '').toLowerCase()) {
    case 'open':
      return STATUS_FALLBACK_COLORS.open;
    case 'in-progress':
      return STATUS_FALLBACK_COLORS['in-progress'];
    case 'under-review':
      return STATUS_FALLBACK_COLORS['under-review'];
    case 'done':
      return STATUS_FALLBACK_COLORS.done;
    default:
      break;
  }

  const normalizedStatus = (status || '').toLowerCase();
  if (normalizedStatus.includes('bug')) return '#da0004';
  if (normalizedStatus.includes('done') || normalizedStatus.includes('complete')) return '#69b86d';
  if (normalizedStatus.includes('review')) return '#d1923a';
  if (normalizedStatus.includes('progress')) return '#1a60cb';
  return '#71717a';
}

export function getTaskProgress(status: string): number {
  return STATUS_PROGRESS[status as TaskStatus] ?? STATUS_PROGRESS.open;
}

export function getStatusVisual(
  statusColumns: Array<Pick<StatusColumn, 'id' | 'title' | 'color'>>,
  status: string,
  explicitColor?: string
): StatusVisual {
  const column = resolveStatusColumn(statusColumns, status);
  const resolvedColorInput = explicitColor ?? column?.color;
  const color = resolveStatusColor(status, resolvedColorInput);
  const backgroundClassName = resolvedColorInput && !isCssColor(resolvedColorInput) ? resolvedColorInput : undefined;

  return {
    id: status,
    label: getStatusLabel(statusColumns, status),
    color,
    backgroundClassName,
    backgroundStyle: backgroundClassName ? undefined : { backgroundColor: color },
    textClassName: getReadableTextClassFor(backgroundClassName || `status-visual-${status}-${color}`, color),
    progressPercent: getTaskProgress(status),
  };
}
