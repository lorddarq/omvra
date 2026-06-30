import { CalendarDays, Search, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ProjectMilestone, Task, TaskStatus, TimelineSwimlane } from '../types';
import {
  getMilestoneDateRangeLabel,
  getMilestoneProjectIds,
  summarizeMilestone,
  type MilestoneHealth,
} from '../utils/roadmap';
import {
  Dialog,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import { DialogSurface, DialogSurfaceBody, DialogSurfaceFooter, DialogSurfaceHeader, DialogSurfaceSection } from './DialogSurface';
import { EmptyStateCard } from './EmptyStateCard';
import { TaskDetailsActionMenu } from './TaskDetailsActionMenu';
import { DependencyStatusPill } from './TaskSummarySection';
import { buildMilestonePdfExportHtml, createMilestonePdfFileName } from '../utils/milestonePdfExport';
import { formatMilestoneDetailsForClipboard } from '../utils/milestoneClipboard';
import { exportPdfDocument } from '../utils/pdfExport';

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

const STATUS_DOT_CLASSES: Record<TaskStatus, string> = {
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

function formatDisplayDate(value?: string): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA');
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
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
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
  const filteredTasks = useMemo(() => {
    const normalizedSearch = taskSearchQuery.trim().toLowerCase();
    if (!normalizedSearch) return sortedTasks;

    return sortedTasks.filter(task => {
      const dependencyTitles = (task.dependencyIds || [])
        .map(dependencyId => sortedTasks.find(item => item.id === dependencyId)?.title || '')
        .join(' ');
      const haystack = [task.title, task.startDate, task.endDate, task.status, dependencyTitles]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [sortedTasks, taskSearchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    setTaskSearchQuery('');
  }, [isOpen, milestone?.id]);

  const handleDelete = () => {
    if (!milestone || !onDelete) return;
    onDelete(milestone.id);
    setDeleteConfirmOpen(false);
  };

  const handleCopyMilestoneDetails = async () => {
    if (!milestone || !summary) return;

    const text = formatMilestoneDetailsForClipboard({
      milestoneId: milestone.id,
      title: milestone.title,
      projectLabels: milestoneProjects.map(project => project.name),
      healthLabel: HEALTH_LABELS[summary.health],
      completionLabel: `${summary.completionPercent}% (${summary.completedTasks} of ${summary.totalTasks} tasks)`,
      dateRangeLabel: getMilestoneDateRangeLabel(milestone),
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

  const handleExportPdf = async () => {
    if (!milestone || !summary || !window.electron?.tasks?.exportPdf || isExportingPdf) return;

    setIsExportingPdf(true);

    const html = buildMilestonePdfExportHtml({
      milestoneId: milestone.id,
      title: milestone.title,
      exportedAt: new Date().toISOString(),
      projectLabels: milestoneProjects.map(project => project.name),
      summaryFields: [
        { label: 'Health', value: HEALTH_LABELS[summary.health] },
        { label: 'Completion', value: `${summary.completionPercent}% (${summary.completedTasks} of ${summary.totalTasks} tasks)` },
        { label: 'Date Range', value: getMilestoneDateRangeLabel(milestone) },
        { label: 'Late Tasks', value: summary.lateTasks.length > 0 ? summary.lateTasks.length : 'None' },
      ],
      notes: milestone.notes,
      linkedTasks: sortedTasks.map(task => {
        const dependencyTasks = (task.dependencyIds || [])
          .map(dependencyId => sortedTasks.find(item => item.id === dependencyId))
          .filter((item): item is Task => Boolean(item));
        const detailParts = [`${task.startDate || 'No start'} to ${task.endDate || 'No end'}`];
        if (dependencyTasks.length > 0) {
          detailParts.push(`Depends on ${dependencyTasks.map(item => item.title).join(', ')}`);
        }
        return {
          title: task.title,
          detail: detailParts.join(' | '),
          badge: getStatusTitle(statusColumns, task.status),
        };
      }),
    });

    try {
      await exportPdfDocument({
        html,
        defaultFileName: createMilestonePdfFileName(milestone.title),
        entityLabel: 'milestone',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogSurface
          showClose={false}
          overlayClassName="omvra-settings-overlay"
          className="h-[min(1600px,calc(100vh-2rem))] w-[min(837px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-[28px] border border-black/5 bg-white p-0 shadow-[0_14px_28px_rgba(0,0,0,0.1),0_-6px_12px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.1)] sm:max-w-none"
        >
          <div className="flex items-start justify-between border-b border-black/6 px-8 py-5">
            <div className="min-w-0">
              <h2 className="break-words text-[18px] font-normal tracking-[-0.02em] text-[#71717a] [overflow-wrap:anywhere]">
                {milestone?.title || 'Roadmap milestone'}
              </h2>
            </div>
            <div className="ml-4 shrink-0">
              <TaskDetailsActionMenu
                copyState={copyState}
                canEdit={Boolean(milestone)}
                canExportPdf={Boolean(window.electron?.tasks?.exportPdf && !isExportingPdf)}
                menuLabel="Milestone actions"
                copyLabel="Copy info"
                exportLabel="Export details"
                onEdit={milestone ? () => onEdit(milestone) : undefined}
                onCopy={handleCopyMilestoneDetails}
                onExportPdf={handleExportPdf}
              />
            </div>
          </div>

          {milestone && summary && (
            <DialogSurfaceBody className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto bg-white px-8 py-8">
              <section className="space-y-4">
                <h3 className="text-[14px] font-semibold text-[#71717a]">Basic Information</h3>
                <DialogSurfaceSection className="grid grid-cols-1 gap-3 rounded-[12px] border-0 bg-[rgba(113,113,122,0.05)] px-4 py-4 shadow-none sm:grid-cols-2 sm:gap-x-10 sm:gap-y-3">
                  <div className="space-y-3">
                    <div>
                      <div className="text-[12px] font-medium text-[#71717a]">Projects:</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {milestoneProjects.length > 0 ? milestoneProjects.map(project => (
                          <span
                            key={project.id}
                            className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#71717a]"
                          >
                            {project.name}
                          </span>
                        )) : (
                          <span className="text-[12px] text-[#71717a]">Unknown project</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-[#71717a]">Start Date</div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <CalendarDays className="size-4 text-[#71717a]" />
                        <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#71717a]">
                          {formatDisplayDate(milestone.startDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-[#71717a]">Health</div>
                        <Badge variant="outline" className={`mt-2 ${HEALTH_CLASSES[summary.health]}`}>
                          {HEALTH_LABELS[summary.health]}
                        </Badge>
                      </div>
                      <div className="shrink-0 rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#71717a]">
                        {summary.completedTasks} / {summary.totalTasks}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-[#71717a]">Completion</div>
                      <div className="mt-2 text-[14px] font-medium text-[#1f2937]">
                        {summary.completionPercent}% ({summary.completedTasks} of {summary.totalTasks} tasks)
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-[#71717a]">End Date</div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <CalendarDays className="size-4 text-[#71717a]" />
                        <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#71717a]">
                          {formatDisplayDate(milestone.endDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                </DialogSurfaceSection>
              </section>

              <section className="space-y-4">
                <h3 className="text-[14px] font-semibold text-[#71717a]">Status Composition</h3>
                <DialogSurfaceSection className="rounded-[12px] border-0 bg-[rgba(113,113,122,0.05)] px-4 py-4 shadow-none">
                  <MilestoneStatusComposition
                    counts={summary.counts}
                    totalTasks={summary.totalTasks}
                    statusColumns={statusColumns}
                  />
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(Object.keys(STATUS_DOT_CLASSES) as TaskStatus[]).map(status => {
                      const count = summary.counts[status] || 0;
                      if (count === 0) return null;
                      return (
                        <span
                          key={status}
                          className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white px-2 py-0.5 text-[12px] font-bold text-[#71717a]"
                        >
                          <span className={`size-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
                          {count}
                        </span>
                      );
                    })}
                  </div>
                </DialogSurfaceSection>
              </section>

              <section className="space-y-4">
                <h3 className="text-[14px] font-semibold text-[#71717a]">Description</h3>
                <DialogSurfaceSection className="relative overflow-hidden rounded-[12px] border border-black/10 bg-white px-4 py-4 shadow-none">
                  <div className="text-[12px] leading-6 text-[#6a7282]">
                    <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {milestone.notes?.trim() || 'No description provided.'}
                    </div>
                  </div>
                </DialogSurfaceSection>
              </section>

              <section className="space-y-6">
                <h3 className="text-[14px] font-semibold text-[#71717a]">Dependencies</h3>

                <div className="space-y-1">
                  <label htmlFor="milestone-task-search" className="text-[12px] font-medium text-[#71717a]">
                    Search task:
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#b5b5ba]" />
                    <Input
                      id="milestone-task-search"
                      value={taskSearchQuery}
                      onChange={(event) => setTaskSearchQuery(event.target.value)}
                      placeholder="Task name"
                      className="h-10 rounded-[12px] border-black/10 bg-white pl-9 text-sm font-normal text-[#4a4a4f] shadow-none placeholder:text-[#b5b5ba] focus-visible:ring-[#71717a]/15"
                    />
                  </div>
                </div>

                {sortedTasks.length === 0 ? (
                  <EmptyStateCard
                    compact
                    title="No linked tasks yet"
                    description="Link task work to this milestone to populate rollout progress, dependency context, and date health."
                  />
                ) : filteredTasks.length === 0 ? (
                  <EmptyStateCard
                    compact
                    title="No linked tasks match this search"
                    description="Try a different task title or dependency keyword."
                  />
                ) : (
                  <DialogSurfaceSection className="relative h-[320px] overflow-hidden rounded-[18px] border border-black/6 bg-white p-3 shadow-[0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
                    <div className="h-full overflow-y-auto pr-1">
                      <div className="divide-y divide-black/5">
                        {filteredTasks.map(task => {
                          const isLate = lateTaskIds.has(task.id);
                          const dependencyTasks = (task.dependencyIds || [])
                            .map(dependencyId => sortedTasks.find(item => item.id === dependencyId))
                            .filter((item): item is Task => Boolean(item));
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => onTaskClick(task)}
                              className="flex w-full items-start justify-between gap-3 px-0 py-3 text-left transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900/10"
                            >
                              <span className="min-w-0 pl-1">
                                <span className="block break-words text-[12px] font-medium leading-5 text-[#4a4a4f] [overflow-wrap:anywhere]">
                                  {task.title}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-[#7b8190]">
                                  {formatDisplayDate(task.startDate)} to {formatDisplayDate(task.endDate)}
                                </span>
                                {dependencyTasks.length > 0 && (
                                  <span className="mt-1 block break-words text-xs leading-5 text-[#7b8190] [overflow-wrap:anywhere]">
                                    Depends on {dependencyTasks.map(item => item.title).join(', ')}
                                  </span>
                                )}
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                {isLate && <TriangleAlert className="size-4 text-red-700" />}
                                <DependencyStatusPill
                                  label={getStatusTitle(statusColumns, task.status)}
                                  statusColor={statusColumns.find(column => column.id === task.status)?.color}
                                />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/92 to-transparent" />
                  </DialogSurfaceSection>
                )}
              </section>
            </DialogSurfaceBody>
          )}

          <DialogSurfaceFooter className="border-t-0 bg-white px-8 pb-6 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-8 rounded-[12px] border-black/10 bg-white px-4 text-[14px] font-normal text-[#67676f] shadow-none hover:bg-[#f3f3f3] hover:text-[#67676f]"
            >
              Close
            </Button>
          </DialogSurfaceFooter>
        </DialogSurface>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogSurface
          showClose={false}
          overlayClassName="omvra-settings-overlay"
          className="max-w-[430px] rounded-[28px] border border-black/5 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
        >
          <DialogSurfaceHeader
            title="Delete milestone?"
            description="This removes the milestone and clears milestone-linked dependency wiring from the affected tasks."
          />
          <DialogSurfaceFooter className="bg-white">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="h-8 rounded-[12px] border-black/10 bg-white px-4 text-[14px] font-normal text-[#67676f] shadow-none hover:bg-[#f3f3f3] hover:text-[#67676f]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              className="h-8 rounded-[12px] border border-[#f0c8c8] bg-[#fbeaea] px-4 text-[14px] font-normal text-[#ff0000] shadow-none hover:bg-[#f7dddd] hover:text-[#ff0000]"
            >
              Delete milestone
            </Button>
          </DialogSurfaceFooter>
        </DialogSurface>
      </Dialog>
    </>
  );
}
