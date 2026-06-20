import { Task, TimelineSwimlane, Person, TaskStatus, StatusColumn, ProjectMilestone } from '../types';
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { getTaskLoadContributionPercent, getTaskLoadPoints } from '../utils/taskLoad';
import { getMilestoneForTask } from '../utils/roadmap';
import { formatTaskDetailsForClipboard } from '../utils/taskClipboard';
import { TaskAttachmentsSection } from './TaskAttachmentsSection';
import { TaskCommentsSection } from './TaskCommentsSection';
import { TaskDescriptionSection } from './TaskDescriptionSection';
import { TaskDetailsActionMenu } from './TaskDetailsActionMenu';
import { TaskFooterActions } from './TaskFooterActions';
import { TaskProjectsSection } from './TaskProjectsSection';
import { TaskSummarySection } from './TaskSummarySection';
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
  const assigneeLabel = `${personLabel}${assignee ? ` (${assignee.kind === 'agentic' ? 'Agentic' : 'Human'})` : ''}`;
  const timelineLabel = task ? `${formatDate(task.startDate)} - ${formatDate(task.endDate)}` : '';
  const milestoneLabel = milestone ? `${milestone.title} (${formatDate(milestone.endDate)})` : 'No roadmap milestone';
  const dependencyLabel = dependencyTasks.length > 0
    ? dependencyTasks.map(dependencyTask => dependencyTask.title).join(', ')
    : 'No roadmap dependencies';
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

  const handleEditTask = () => {
    if (!task || !onEdit) return;
    onEdit(task);
  };

  const handleMoveAgentTaskToReview = () => {
    if (!task || !onMoveAgentTaskToReview) return;
    onMoveAgentTaskToReview(task.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-[760px]">
        <DialogHeader className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-3 pr-8">
            <DialogTitle className="min-w-0 break-words [overflow-wrap:anywhere]">
              {task?.title || 'Task details'}
            </DialogTitle>
            {task && (
              <TaskDetailsActionMenu
                copyState={copyState}
                canEdit={Boolean(onEdit)}
                onEdit={handleEditTask}
                onCopy={handleCopyTaskDetails}
              />
            )}
          </div>
          <DialogDescription className="min-w-0 break-words [overflow-wrap:anywhere]">Review task details and markdown description.</DialogDescription>
        </DialogHeader>

        {task && (
          <div className="min-w-0 space-y-4 py-2">
            <TaskSummarySection
              statusLabel={statusLabel}
              primaryTimelineProject={primaryTimelineProject}
              assigneeLabel={assigneeLabel}
              timelineLabel={timelineLabel}
              taskSizeLabel={(task.size || 'm').toUpperCase()}
              complexityLabel={task.complexity || 'medium'}
              priorityLabel={priorityLabel}
              blockedLabel={task.blocked ? 'Yes' : 'No'}
              milestoneLabel={milestoneLabel}
              dependencyLabel={dependencyLabel}
              taskLoadPoints={taskLoadPoints}
              taskLoadContribution={taskLoadContribution}
            />

            <TaskProjectsSection projectLabels={projectLabels} />

            <TaskDescriptionSection notes={task.notes} />

            <TaskAttachmentsSection
              attachments={task.attachments}
              canReveal={Boolean(window.electron?.attachments?.reveal)}
              onRevealAttachment={handleRevealAttachment}
            />

            <TaskCommentsSection
              comments={sortedComments}
              newComment={newComment}
              onNewCommentChange={setNewComment}
              onAddComment={handleAddComment}
              formatDate={formatDate}
              canAddComment={Boolean(newComment.trim() && task)}
            />
          </div>
        )}

        <TaskFooterActions
          canMoveToReview={Boolean(task && canMoveAgentTaskToReview && onMoveAgentTaskToReview)}
          canEdit={Boolean(task && onEdit)}
          editAlignsLeft={!canMoveAgentTaskToReview}
          onMoveToReview={handleMoveAgentTaskToReview}
          onEdit={handleEditTask}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
