export interface TaskClipboardDetails {
  taskId: string;
  title: string;
  assigneeLabel?: string | null;
  projectLabels?: string[];
  statusLabel?: string | null;
}

export function formatTaskDetailsForClipboard({
  taskId,
  title,
  assigneeLabel,
  projectLabels = [],
  statusLabel,
}: TaskClipboardDetails): string {
  const projectLabel = projectLabels.length > 0 ? projectLabels.join(', ') : 'No project';

  return [
    `Task: ${title}`,
    `ID: ${taskId}`,
    `Allocated to: ${assigneeLabel || 'Unassigned'}`,
    `Project: ${projectLabel}`,
    `Status: ${statusLabel || 'Unknown status'}`,
  ].join('\n');
}
