import { Task, TimelineSwimlane, Person, TaskStatus } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { MarkdownContent } from './MarkdownContent';
import { getTaskLoadContributionPercent, getTaskLoadPoints, PERSON_CAPACITY_POINTS } from '../utils/taskLoad';

interface TaskDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onMoveAgentTaskToReview?: (taskId: string) => void;
  task?: Task | null;
  swimlanes: TimelineSwimlane[];
  people: Person[];
  statusColumns: Array<{ id: TaskStatus; title: string; color?: string }>;
}

function formatDate(dateValue?: string): string {
  if (!dateValue) return 'Not set';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString();
}

export function TaskDetailsDialog({
  isOpen,
  onClose,
  onEdit,
  onMoveAgentTaskToReview,
  task,
  swimlanes,
  people,
  statusColumns,
}: TaskDetailsDialogProps) {
  const primaryTimelineProject = task?.swimlaneId
    ? swimlanes.find(s => s.id === task.swimlaneId)?.name ?? 'Unknown swimlane'
    : 'No timeline project';
  const projectLabels = task?.projectIds?.length
    ? task.projectIds
        .map(projectId => swimlanes.find(s => s.id === projectId)?.name)
        .filter((label): label is string => Boolean(label))
    : [];
  const personLabel = task?.assigneeId
    ? people.find(p => p.id === task.assigneeId)?.name ?? 'Unknown assignee'
    : 'Unassigned';
  const assignee = task?.assigneeId ? people.find(p => p.id === task.assigneeId) : null;
  const statusLabel = task
    ? statusColumns.find(c => c.id === task.status)?.title ?? task.status
    : '';
  const taskLoadPoints = task ? getTaskLoadPoints(task) : 0;
  const taskLoadContribution = task && task.assigneeId
    ? getTaskLoadContributionPercent(task)
    : null;
  const priorityLabel = task
    ? ({
        urgent: 'Urgent',
        moderate: 'Moderate',
        normal: 'Normal',
        low: 'Low priority',
      } as const)[task.priority || 'normal']
    : '';
  const canMoveAgentTaskToReview = Boolean(
    task &&
    assignee &&
    assignee.kind === 'agentic' &&
    task.status === 'in-progress'
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{task?.title || 'Task details'}</DialogTitle>
          <DialogDescription>Review task details and markdown description.</DialogDescription>
        </DialogHeader>

        {task && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 rounded-md bg-gray-50 p-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
                <div className="text-xs font-medium text-gray-900">{statusLabel}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Primary Timeline Project</div>
                <div className="text-xs font-medium text-gray-900">{primaryTimelineProject}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Assignee</div>
                <div className="text-xs font-medium text-gray-900">
                  {personLabel}
                  {assignee ? ` (${assignee.kind === 'agentic' ? 'Agentic' : 'Human'})` : ''}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Timeline</div>
                <div className="text-xs font-medium text-gray-900">
                  {formatDate(task.startDate)} - {formatDate(task.endDate)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Task Size</div>
                <div className="text-sm font-medium text-gray-900">{(task.size || 'm').toUpperCase()}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Complexity</div>
                <div className="text-sm font-medium text-gray-900 capitalize">{task.complexity || 'medium'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Priority</div>
                <div className="text-sm font-medium text-gray-900">{priorityLabel}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Blocked</div>
                <div className="text-sm font-medium text-gray-900">{task.blocked ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Load Points</div>
                <div className="text-sm font-medium text-gray-900">{taskLoadPoints.toFixed(1)} / {PERSON_CAPACITY_POINTS}</div>
              </div>
              {taskLoadContribution !== null && (
                <div className="col-span-2">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Person Load Contribution</div>
                  <div className="text-sm font-medium text-gray-900">{taskLoadContribution}%</div>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-md border bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Projects</div>
              {projectLabels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {projectLabels.map(projectName => (
                    <span key={projectName} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                      {projectName}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No projects assigned.</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">Description</div>
              <div className="rounded-md border bg-white p-4">
                {task.notes?.trim() ? (
                  <MarkdownContent content={task.notes} />
                ) : (
                  <div className="text-sm text-gray-500">No description provided.</div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {task && canMoveAgentTaskToReview && onMoveAgentTaskToReview && (
            <Button
              variant="outline"
              className="mr-auto"
              onClick={() => onMoveAgentTaskToReview(task.id)}
            >
              Move to In Review
            </Button>
          )}
          {task && onEdit && (
            <Button
              variant="outline"
              className={canMoveAgentTaskToReview ? '' : 'mr-auto'}
              onClick={() => onEdit(task)}
            >
              Edit
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
