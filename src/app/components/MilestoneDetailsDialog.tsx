import { CalendarDays, Edit3, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { ProjectMilestone, Task, TaskStatus, TimelineSwimlane } from '../types';
import {
  getMilestoneDateRangeLabel,
  getMilestoneProjectIds,
  summarizeMilestone,
  type MilestoneHealth,
} from '../utils/roadmap';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import { DialogSurface, DialogSurfaceBody, DialogSurfaceFooter, DialogSurfaceHeader, DialogSurfaceSection } from './DialogSurface';
import { EmptyStateCard } from './EmptyStateCard';

interface MilestoneDetailsDialogProps {
  isOpen: boolean;
  milestone?: ProjectMilestone | null;
  projects: TimelineSwimlane[];
  tasks: Task[];
  statusColumns: Array<{ id: TaskStatus; title: string; color?: string }>;
  readModel?: WorkspaceReadModel;
  onClose: () => void;
  onEdit: (milestone: ProjectMilestone) => void;
  onDelete?: (milestoneId: string) => void;
  onTaskClick: (task: Task) => void;
}

const HEALTH_LABELS: Record<MilestoneHealth, string> = {
  complete: 'Complete',
  'at-risk': 'At risk',
  'in-progress': 'In progress',
  planned: 'Planned',
  empty: 'No tasks',
};

const HEALTH_CLASSES: Record<MilestoneHealth, string> = {
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'at-risk': 'border-red-200 bg-red-50 text-red-700',
  'in-progress': 'border-blue-200 bg-blue-50 text-blue-700',
  planned: 'border-gray-200 bg-gray-50 text-gray-700',
  empty: 'border-gray-200 bg-white text-gray-500',
};

const STATUS_SEGMENT_CLASSES: Record<TaskStatus, string> = {
  open: 'bg-gray-300',
  'in-progress': 'bg-blue-500',
  'under-review': 'bg-amber-500',
  done: 'bg-emerald-500',
};

function getStatusTitle(
  statusColumns: MilestoneDetailsDialogProps['statusColumns'],
  status: TaskStatus
): string {
  return statusColumns.find(column => column.id === status)?.title || status;
}

function MilestoneStatusComposition({
  counts,
  totalTasks,
  statusColumns,
}: {
  counts: Record<TaskStatus, number>;
  totalTasks: number;
  statusColumns: MilestoneDetailsDialogProps['statusColumns'];
}) {
  if (totalTasks === 0) {
    return <div className="h-2 rounded-full bg-gray-100" aria-label="No linked tasks" />;
  }

  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-gray-100" aria-label="Milestone task status composition">
      {(Object.keys(STATUS_SEGMENT_CLASSES) as TaskStatus[]).map(status => {
        const count = counts[status] || 0;
        if (count === 0) return null;

        return (
          <div
            key={status}
            className={STATUS_SEGMENT_CLASSES[status]}
            style={{ width: `${(count / totalTasks) * 100}%` }}
            title={`${count} ${getStatusTitle(statusColumns, status)} task${count === 1 ? '' : 's'}`}
          />
        );
      })}
    </div>
  );
}

export function MilestoneDetailsDialog({
  isOpen,
  milestone,
  projects,
  tasks,
  statusColumns,
  readModel,
  onClose,
  onEdit,
  onDelete,
  onTaskClick,
}: MilestoneDetailsDialogProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const enrichedMilestone = milestone ? readModel?.milestonesById.get(milestone.id) : undefined;
  const milestoneProjects = enrichedMilestone?.projects ?? (milestone
    ? projects.filter(item => getMilestoneProjectIds(milestone).includes(item.id))
    : []);
  const summary = enrichedMilestone?.summary ?? (milestone ? summarizeMilestone(milestone, tasks) : null);
  const lateTaskIds = new Set(summary?.lateTasks.map(task => task.id) || []);
  const sortedTasks = summary
    ? [...summary.linkedTasks].sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''))
    : [];
  const canDelete = Boolean(milestone && onDelete);

  const handleDelete = () => {
    if (!milestone || !onDelete) return;
    onDelete(milestone.id);
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogSurface className="sm:max-w-[760px]">
        <DialogSurfaceHeader
          title={milestone?.title || 'Roadmap milestone'}
          description="Review milestone health, linked task progress, and date risk."
        />

        {milestone && summary && (
          <DialogSurfaceBody>
            <DialogSurfaceSection className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-[#7b8190]">Projects</div>
                <div className="break-words text-sm font-medium text-[#111827] [overflow-wrap:anywhere]">
                  {milestoneProjects.length > 0
                    ? milestoneProjects.map(project => project.name).join(', ')
                    : 'Unknown project'}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-[#7b8190]">Date range</div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-[#111827]">
                  <CalendarDays className="size-3.5 text-[#7b8190]" />
                  {getMilestoneDateRangeLabel(milestone)}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-[#7b8190]">Health</div>
                <Badge variant="outline" className={HEALTH_CLASSES[summary.health]}>
                  {HEALTH_LABELS[summary.health]}
                </Badge>
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-[#7b8190]">Completion</div>
                <div className="text-sm font-medium text-[#111827]">
                  {summary.completionPercent}% ({summary.completedTasks} of {summary.totalTasks} tasks)
                </div>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <div className="mb-2 text-xs uppercase tracking-wide text-[#7b8190]">Status composition</div>
                <MilestoneStatusComposition
                  counts={summary.counts}
                  totalTasks={summary.totalTasks}
                  statusColumns={statusColumns}
                />
              </div>
            </DialogSurfaceSection>

            {summary.lateTasks.length > 0 && (
              <section className="rounded-[24px] border border-red-200 bg-red-50/90 p-4 shadow-[0_1px_2px_rgba(239,68,68,0.08)]">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-700" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-900">Date risk detected</h3>
                    <p className="mt-1 text-sm text-red-800">
                      {summary.lateTasks.length} linked task{summary.lateTasks.length === 1 ? '' : 's'} end after this milestone.
                    </p>
                  </div>
                </div>
              </section>
            )}

            <DialogSurfaceSection>
              <h3 className="text-sm font-semibold text-[#111827]">Linked tasks</h3>
              {sortedTasks.length === 0 ? (
                <div className="mt-3">
                  <EmptyStateCard
                    compact
                    title="No linked tasks yet"
                    description="Link task work to this milestone to populate rollout progress, dependency context, and date health."
                  />
                </div>
              ) : (
                <div className="mt-3 grid gap-2">
                  {sortedTasks.map(task => {
                    const isLate = lateTaskIds.has(task.id);
                    const dependencyTasks = (task.dependencyIds || [])
                      .map(dependencyId => sortedTasks.find(item => item.id === dependencyId))
                      .filter((item): item is Task => Boolean(item));
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onTaskClick(task)}
                        className={`flex items-start justify-between gap-3 rounded-2xl border p-3 text-left transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 ${
                          isLate ? 'border-red-200 bg-red-50/60' : 'border-black/6 bg-white'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-medium text-[#111827] [overflow-wrap:anywhere]">
                            {task.title}
                          </span>
                          <span className="mt-1 block text-xs text-[#7b8190]">
                            {task.startDate || 'No start'} to {task.endDate || 'No end'}
                          </span>
                          {dependencyTasks.length > 0 && (
                            <span className="mt-1 block break-words text-xs text-[#7b8190] [overflow-wrap:anywhere]">
                              Depends on {dependencyTasks.map(item => item.title).join(', ')}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {isLate && <TriangleAlert className="size-4 text-red-700" />}
                          <Badge variant="outline" className="text-gray-600">
                            {getStatusTitle(statusColumns, task.status)}
                          </Badge>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </DialogSurfaceSection>

            {milestone.notes?.trim() && (
              <DialogSurfaceSection>
                <h3 className="text-sm font-semibold text-[#111827]">Notes</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#4b5563] [overflow-wrap:anywhere]">
                  {milestone.notes}
                </p>
              </DialogSurfaceSection>
            )}
          </DialogSurfaceBody>
        )}

        <DialogSurfaceFooter>
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              className="mr-auto h-10 rounded-2xl"
            >
              Delete milestone
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose} className="h-10 rounded-2xl">
            Close
          </Button>
          {milestone && (
            <Button type="button" onClick={() => onEdit(milestone)} className="h-10 gap-2 rounded-2xl">
              <Edit3 className="size-4" />
              Edit milestone
            </Button>
          )}
        </DialogSurfaceFooter>
        </DialogSurface>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogSurface className="max-w-[430px]">
          <DialogHeader className="border-b border-black/6 px-6 py-5 text-left">
            <DialogTitle className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#111827]">
              Delete milestone?
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#6b7280]">
              This removes the milestone and clears milestone-linked dependency wiring from the affected tasks.
            </DialogDescription>
          </DialogHeader>
          <DialogSurfaceFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="h-10 rounded-2xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="h-10 rounded-2xl"
            >
              Delete milestone
            </Button>
          </DialogSurfaceFooter>
        </DialogSurface>
      </Dialog>
    </>
  );
}
