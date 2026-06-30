export interface MilestoneClipboardDetails {
  milestoneId: string;
  title: string;
  projectLabels?: string[];
  healthLabel?: string | null;
  completionLabel?: string | null;
  dateRangeLabel?: string | null;
}

export function formatMilestoneDetailsForClipboard({
  milestoneId,
  title,
  projectLabels = [],
  healthLabel,
  completionLabel,
  dateRangeLabel,
}: MilestoneClipboardDetails): string {
  const projectLabel = projectLabels.length > 0 ? projectLabels.join(', ') : 'No project';

  return [
    `Milestone: ${title}`,
    `ID: ${milestoneId}`,
    `Project: ${projectLabel}`,
    `Health: ${healthLabel || 'Unknown health'}`,
    `Completion: ${completionLabel || 'Unknown completion'}`,
    `Date Range: ${dateRangeLabel || 'Not set'}`,
  ].join('\n');
}
