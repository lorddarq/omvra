import { CalendarDays, Search, TriangleAlert } from 'lucide-react';
import {
  getMilestoneHealthVisual,
  getStatusLabel,
  resolveStatusColor,
  getStatusVisual,
  type RoadmapMilestoneSummary,
} from '../utils/roadmap';
import type { Task, TaskStatus, TimelineSwimlane } from '../types';
import { EmptyStateCard } from './EmptyStateCard';
import { DependencyStatusPill } from './TaskSummarySection';
import { DialogSurfaceSection } from './DialogSurface';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';

const milestoneDialogSearchInputClassName = 'h-10 rounded-2xl border border-black/8 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]';

type MilestoneStatusColumn = Array<{ id: TaskStatus; title: string; color?: string }>;

function formatDisplayDate(value?: string): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA');
}

export function MilestoneStatusComposition({
  counts,
  totalTasks,
  statusColumns,
}: {
  counts: Record<TaskStatus, number>;
  totalTasks: number;
  statusColumns: MilestoneStatusColumn;
}) {
  if (totalTasks === 0) {
    return <div className="h-2 rounded-full bg-gray-100" aria-label="No linked tasks" />;
  }

  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-gray-100" aria-label="Milestone task status composition">
      {statusColumns.map(column => {
        const count = counts[column.id] || 0;
        if (count === 0) return null;

        const visual = getStatusVisual(statusColumns, column.id);
        return (
          <div
            key={column.id}
            className={visual.backgroundClassName}
            style={{
              ...visual.backgroundStyle,
              width: `${(count / totalTasks) * 100}%`,
            }}
            title={`${count} ${visual.label} task${count === 1 ? '' : 's'}`}
          />
        );
      })}
    </div>
  );
}

export function MilestoneSummaryCard({
  projects,
  summary,
  statusColumns,
  startDate,
  endDate,
}: {
  projects: TimelineSwimlane[];
  summary: RoadmapMilestoneSummary;
  statusColumns: MilestoneStatusColumn;
  startDate?: string;
  endDate?: string;
}) {
  const healthVisual = getMilestoneHealthVisual(summary.health);

  return (
    <>
      <section className="space-y-4">
        <h3 className="text-[14px] font-semibold text-[#71717a]">Basic Information</h3>
        <DialogSurfaceSection className="grid grid-cols-1 gap-3 rounded-[12px] border-0 bg-[rgba(113,113,122,0.05)] px-4 py-4 shadow-none sm:grid-cols-2 sm:gap-x-10 sm:gap-y-3">
          <div className="space-y-3">
            <div>
              <div className="text-[12px] font-medium text-[#71717a]">Projects:</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {projects.length > 0 ? projects.map(project => (
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
                  {formatDisplayDate(startDate)}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-[#71717a]">Health</div>
                <Badge variant="outline" className={`mt-2 ${healthVisual.className}`}>
                  {healthVisual.label}
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
                  {formatDisplayDate(endDate)}
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
            {(['open', 'in-progress', 'under-review', 'done'] as TaskStatus[]).map(status => {
              const count = summary.counts[status] || 0;
              if (count === 0) return null;
              const visual = getStatusVisual(statusColumns, status);
              return (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white px-2 py-0.5 text-[12px] font-bold text-[#71717a]"
                >
                  <span className={`size-2 rounded-full ${visual.backgroundClassName || ''}`} style={visual.backgroundStyle} />
                  {count}
                </span>
              );
            })}
          </div>
        </DialogSurfaceSection>
      </section>
    </>
  );
}

export function MilestoneLinkedTasksSection({
  tasks,
  lateTaskIds,
  statusColumns,
  searchQuery,
  onSearchQueryChange,
  onTaskClick,
}: {
  tasks: Task[];
  lateTaskIds: Set<string>;
  statusColumns: MilestoneStatusColumn;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onTaskClick: (task: Task) => void;
}) {
  return (
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
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Task name"
            className="h-10 rounded-[12px] border-black/10 bg-white pl-9 text-sm font-normal text-[#4a4a4f] shadow-none placeholder:text-[#b5b5ba] focus-visible:ring-[#71717a]/15"
          />
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyStateCard
          compact
          title="No linked tasks yet"
          description="Link task work to this milestone to populate rollout progress, dependency context, and date health."
        />
      ) : (
        <DialogSurfaceSection className="relative h-[320px] overflow-hidden rounded-[18px] border border-black/6 bg-white p-3 shadow-[0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
          <div className="h-full overflow-y-auto pr-1">
            <div className="divide-y divide-black/5">
              {tasks.map(task => {
                const isLate = lateTaskIds.has(task.id);
                const dependencyTasks = (task.dependencyIds || [])
                  .map(dependencyId => tasks.find(item => item.id === dependencyId))
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
                        label={getStatusLabel(statusColumns, task.status)}
                        statusColor={resolveStatusColor(
                          task.status,
                          statusColumns.find(column => column.id === task.status)?.color
                        )}
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
  );
}

export function MilestoneTaskLinker({
  projectTasks,
  filteredProjectTasks,
  linkedTaskIds,
  dependencyIdsByTaskId,
  statusColumns,
  taskSearchQuery,
  onTaskSearchQueryChange,
  onToggleTask,
  onToggleDependency,
}: {
  projectTasks: Task[];
  filteredProjectTasks: Task[];
  linkedTaskIds: string[];
  dependencyIdsByTaskId: Record<string, string[]>;
  statusColumns: MilestoneStatusColumn;
  taskSearchQuery: string;
  onTaskSearchQueryChange: (value: string) => void;
  onToggleTask: (taskId: string) => void;
  onToggleDependency: (taskId: string, dependencyId: string) => void;
}) {
  return (
    <DialogSurfaceSection>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">Linked tasks</h3>
          <p className="text-sm text-[#6b7280]">These tasks drive the milestone rollup and deadline flags.</p>
        </div>
        <span className="rounded-full border border-black/6 bg-white px-2.5 py-1 text-xs font-medium text-[#6b7280]">
          {linkedTaskIds.length} selected
        </span>
      </div>
      <div className="mb-3">
        <Label htmlFor="milestone-task-search" className="sr-only">Search milestone tasks</Label>
        <Input
          id="milestone-task-search"
          value={taskSearchQuery}
          onChange={(event) => onTaskSearchQueryChange(event.target.value)}
          placeholder="Search tasks by title, notes, status, or project..."
          className={milestoneDialogSearchInputClassName}
        />
      </div>
      {projectTasks.length === 0 ? (
        <EmptyStateCard
          compact
          title="No tasks in this project scope"
          description="Add tasks to the selected roadmap projects first, then link the milestone work from this list."
        />
      ) : filteredProjectTasks.length === 0 ? (
        <EmptyStateCard
          compact
          title="No tasks match this search"
          description="Try a different task title, status, note, or project keyword to find the right milestone work."
        />
      ) : (
        <div className="grid gap-2">
          {filteredProjectTasks.map(task => {
            const isLinked = linkedTaskIds.includes(task.id);
            const dependencyOptions = projectTasks.filter(
              option => option.id !== task.id && linkedTaskIds.includes(option.id)
            );
            return (
              <div
                key={task.id}
                className={`rounded-2xl border p-3 text-sm transition-colors ${
                  isLinked
                    ? 'border-[#1a60cb]/15 bg-[#edf3ff]'
                    : 'border-black/6 bg-white hover:bg-[#f8fafc]'
                }`}
              >
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isLinked}
                    onChange={() => onToggleTask(task.id)}
                    aria-label={`Link ${task.title} to this milestone`}
                    className="size-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-[#1f2937]">{task.title}</span>
                  <span className="rounded-full border border-black/6 bg-white px-2 py-0.5 text-xs text-[#6b7280]">
                    {getStatusLabel(statusColumns, task.status)}
                  </span>
                </label>

                {isLinked && dependencyOptions.length > 0 && (
                  <MilestoneDependencyEditor
                    task={task}
                    dependencyOptions={dependencyOptions}
                    selectedDependencyIds={dependencyIdsByTaskId[task.id] || []}
                    onToggleDependency={onToggleDependency}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </DialogSurfaceSection>
  );
}

export function MilestoneDependencyEditor({
  task,
  dependencyOptions,
  selectedDependencyIds,
  onToggleDependency,
}: {
  task: Task;
  dependencyOptions: Task[];
  selectedDependencyIds: string[];
  onToggleDependency: (taskId: string, dependencyId: string) => void;
}) {
  return (
    <div className="mt-3 border-l border-[#dbe4f1] pl-7">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#7b8190]">
        Depends on
      </div>
      <div className="grid gap-1.5">
        {dependencyOptions.map(option => (
          <label key={option.id} className="flex cursor-pointer items-center gap-2 text-xs text-[#4b5563]">
            <input
              type="checkbox"
              checked={selectedDependencyIds.includes(option.id)}
              onChange={() => onToggleDependency(task.id, option.id)}
              aria-label={`${task.title} depends on ${option.title}`}
              className="size-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <span className="min-w-0 truncate">{option.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
