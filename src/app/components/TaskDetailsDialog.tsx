import { Task, TimelineSwimlane, Person, TaskStatus, StatusColumn, ProjectMilestone } from '../types';
import { useMemo, useState } from 'react';
import { Check, Copy, FolderSearch, Paperclip, TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { MarkdownContent } from './MarkdownContent';
import { getTaskLoadContributionPercent, getTaskLoadPoints, PERSON_CAPACITY_POINTS } from '../utils/taskLoad';
import { getMilestoneForTask } from '../utils/roadmap';
import { formatTaskDetailsForClipboard } from '../utils/taskClipboard';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';

interface TaskDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onMoveAgentTaskToReview?: (taskId: string) => void;
  onAddComment?: (taskId: string, content: string) => void;
  task?: Task | null;
  swimlanes: TimelineSwimlane[];
  people: Person[];
  statusColumns: StatusColumn[];
  tasks?: Task[];
  milestones?: ProjectMilestone[];
  readModel?: WorkspaceReadModel;
}

function formatDate(dateValue?: string): string {
  if (!dateValue) return 'Not set';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString();
}

function formatAttachmentSize(size?: number): string {
  if (!Number.isFinite(size) || !size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskDetailsDialog({
  isOpen,
  onClose,
  onEdit,
  onMoveAgentTaskToReview,
  onAddComment,
  task,
  swimlanes,
  people,
  statusColumns,
  tasks = [],
  milestones = [],
  readModel,
}: TaskDetailsDialogProps) {
  const [newComment, setNewComment] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const enrichedTask = task ? readModel?.tasksById.get(task.id) : undefined;
  const primaryTimelineProject = enrichedTask?.primaryTimelineProject?.name
    ?? (task?.swimlaneId
    ? swimlanes.find(s => s.id === task.swimlaneId)?.name ?? 'Unknown swimlane'
    : 'No timeline project');
  const projectLabels = enrichedTask
    ? enrichedTask.projects.map(project => project.name)
    : task?.projectIds?.length
    ? task.projectIds
        .map(projectId => swimlanes.find(s => s.id === projectId)?.name)
        .filter((label): label is string => Boolean(label))
    : [];
  const personLabel = enrichedTask?.assignee?.name
    ? enrichedTask.assignee.name
    : task?.assigneeId
    ? people.find(p => p.id === task.assigneeId)?.name ?? 'Unknown assignee'
    : 'Unassigned';
  const milestone = enrichedTask?.milestone ?? getMilestoneForTask(task, milestones);
  const dependencyTasks = enrichedTask
    ? enrichedTask.dependencyTasks.map(item => item.task)
    : task
      ? (task.dependencyIds || [])
          .map(dependencyId => tasks.find(item => item.id === dependencyId))
          .filter((item): item is Task => Boolean(item))
      : [];
  const assignee = enrichedTask?.assignee ?? (task?.assigneeId ? people.find(p => p.id === task.assigneeId) : null);
  const statusLabel = task
    ? enrichedTask?.statusColumn?.title ?? statusColumns.find(c => c.id === task.status)?.title ?? task.status
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
  const sortedComments = useMemo(
    () => [...(task?.comments || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [task?.comments]
  );

  const handleAddComment = () => {
    if (!task || !onAddComment || !newComment.trim()) return;
    onAddComment(task.id, newComment);
    setNewComment('');
  };

  const handleCopyTaskDetails = async () => {
    if (!task) return;

    const text = formatTaskDetailsForClipboard({
      taskId: task.id,
      title: task.title,
      assigneeLabel: personLabel,
      projectLabels,
      statusLabel,
    });

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof window !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } else {
        throw new Error('Clipboard is unavailable');
      }

      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1400);
    } catch {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 1800);
    }
  };

  const handleRevealAttachment = async (filePath: string) => {
    await window.electron?.attachments?.reveal?.(filePath);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle className="break-words [overflow-wrap:anywhere]">
              {task?.title || 'Task details'}
            </DialogTitle>
            {task && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-[-2px] shrink-0"
                aria-label="Copy task details"
                title="Copy task details"
                onClick={handleCopyTaskDetails}
              >
                {copyState === 'copied' ? (
                  <Check className="size-4" />
                ) : copyState === 'failed' ? (
                  <TriangleAlert className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy'}
              </Button>
            )}
          </div>
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
                <div className="text-xs uppercase tracking-wide text-gray-500">Roadmap Milestone</div>
                <div className="text-sm font-medium text-gray-900">
                  {milestone ? `${milestone.title} (${formatDate(milestone.endDate)})` : 'No roadmap milestone'}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Roadmap Dependencies</div>
                <div className="text-sm font-medium text-gray-900">
                  {dependencyTasks.length > 0
                    ? dependencyTasks.map(dependencyTask => dependencyTask.title).join(', ')
                    : 'No roadmap dependencies'}
                </div>
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

            <div className="space-y-2 rounded-md border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Paperclip className="size-4" />
                  Attachments
                </div>
                <div className="text-xs text-gray-500">{task.attachments?.length || 0} total</div>
              </div>

              {task.attachments?.length ? (
                <div className="space-y-2">
                  {task.attachments.map(attachment => {
                    const sizeLabel = formatAttachmentSize(attachment.size);
                    return (
                      <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{attachment.name}</div>
                          <div className="truncate text-xs text-gray-500">
                            {attachment.path}{sizeLabel ? ` - ${sizeLabel}` : ''}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 shrink-0 gap-2 px-2"
                          onClick={() => handleRevealAttachment(attachment.path)}
                          disabled={!window.electron?.attachments?.reveal}
                        >
                          <FolderSearch className="size-4" />
                          Show
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No files attached.</div>
              )}
            </div>

            <div className="space-y-3 rounded-md border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">Comments</div>
                <div className="text-xs text-gray-500">{sortedComments.length} total</div>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Add a comment..."
                  className="min-h-[96px] resize-y"
                />
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleAddComment} disabled={!newComment.trim() || !task}>
                    Add comment
                  </Button>
                </div>
              </div>

              {sortedComments.length > 0 ? (
                <div className="space-y-2">
                  {sortedComments.map((comment) => (
                    <div key={comment.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-gray-900">{comment.author}</div>
                        <div className="text-xs text-gray-500">{formatDate(comment.createdAt)}</div>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No comments yet.</div>
              )}
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
