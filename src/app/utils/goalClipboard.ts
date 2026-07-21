export interface GoalClipboardDetails {
  goalId: string;
  title: string;
  revision?: number;
  status?: string | null;
  overseerLabel?: string | null;
  agentLabels?: string[];
  deliverableLabels?: string[];
  nodeCount?: number;
  notes?: string | null;
}

export function formatGoalDetailsForClipboard({
  goalId,
  title,
  revision,
  status,
  overseerLabel,
  agentLabels = [],
  deliverableLabels = [],
  nodeCount,
  notes,
}: GoalClipboardDetails): string {
  const lines = [
    `Goal: ${title}`,
    `ID: ${goalId}`,
    `Revision: ${revision ?? 0}`,
    `Status: ${status || 'Draft'}`,
    `Overseer: ${overseerLabel || 'Unassigned'}`,
    `Agents: ${agentLabels.length ? agentLabels.join(', ') : 'None'}`,
    `Deliverables: ${deliverableLabels.length ? deliverableLabels.join(', ') : 'None'}`,
    `Nodes: ${nodeCount ?? 0}`,
  ];
  if (notes?.trim()) lines.push(`Notes: ${notes.trim()}`);
  return lines.join('\n');
}
