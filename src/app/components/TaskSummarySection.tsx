import { PERSON_CAPACITY_POINTS } from '../utils/taskLoad';

interface TaskSummarySectionProps {
  statusLabel: string;
  primaryTimelineProject: string;
  assigneeLabel: string;
  timelineLabel: string;
  taskSizeLabel: string;
  complexityLabel: string;
  priorityLabel: string;
  blockedLabel: string;
  milestoneLabel: string;
  dependencyLabel: string;
  taskLoadPoints: number;
  taskLoadContribution: number | null;
}

export function TaskSummarySection({
  statusLabel,
  primaryTimelineProject,
  assigneeLabel,
  timelineLabel,
  taskSizeLabel,
  complexityLabel,
  priorityLabel,
  blockedLabel,
  milestoneLabel,
  dependencyLabel,
  taskLoadPoints,
  taskLoadContribution,
}: TaskSummarySectionProps) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 rounded-md bg-gray-50 p-3 sm:grid-cols-2">
      <SummaryField label="Status" value={statusLabel} compact />
      <SummaryField label="Primary Timeline Project" value={primaryTimelineProject} compact />
      <SummaryField label="Assignee" value={assigneeLabel} compact />
      <SummaryField label="Timeline" value={timelineLabel} compact />
      <SummaryField label="Task Size" value={taskSizeLabel} />
      <SummaryField label="Complexity" value={complexityLabel} capitalize />
      <SummaryField label="Priority" value={priorityLabel} />
      <SummaryField label="Blocked" value={blockedLabel} />
      <SummaryField label="Roadmap Milestone" value={milestoneLabel} />
      <SummaryField label="Roadmap Dependencies" value={dependencyLabel} />
      <SummaryField label="Load Points" value={`${taskLoadPoints.toFixed(1)} / ${PERSON_CAPACITY_POINTS}`} />
      {taskLoadContribution !== null && (
        <SummaryField
          label="Person Load Contribution"
          value={`${taskLoadContribution}%`}
          className="sm:col-span-2"
        />
      )}
    </div>
  );
}

interface SummaryFieldProps {
  label: string;
  value: string;
  compact?: boolean;
  capitalize?: boolean;
  className?: string;
}

function SummaryField({ label, value, compact = false, capitalize = false, className = '' }: SummaryFieldProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div
        className={`break-words font-medium text-gray-900 [overflow-wrap:anywhere] ${
          compact ? 'text-xs' : 'text-sm'
        } ${capitalize ? 'capitalize' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}
