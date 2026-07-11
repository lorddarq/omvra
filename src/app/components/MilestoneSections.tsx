import { CalendarDays, Search, TriangleAlert } from 'lucide-react';
import {
  getMilestoneHealthVisual,
  getStatusLabel,
  getStatusVisual,
  type RoadmapMilestoneSummary,
} from '../utils/roadmap';
import { DateRangeLabel } from './DateRangeLabel';
import { ProjectBadge } from './ProjectBadge';
import type { StatusColumn, Task, TimelineSwimlane } from '../types';
import { EmptyStateCard } from './EmptyStateCard';
import { DependencyStatusPill } from './TaskSummarySection';
import { DialogSurfaceSection } from './DialogSurface';
import { TaskCheckboxControl } from './TaskCheckboxControl';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { taskEditIconFieldClassName } from './taskFormStyles';

type MilestoneStatusColumn = StatusColumn[];

export function MilestoneStatusComposition({
  counts,
  totalTasks,
  statusColumns,
}: {
  counts: Record<string, number>;
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
                  <ProjectBadge
                    key={project.id}
                    project={project}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#71717a]"
                  />
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
                  <DateRangeLabel startDate={startDate} className="" />
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
                  <DateRangeLabel endDate={endDate} className="" />
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
                const statusVisual = getStatusVisual(statusColumns, task.status);
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
                        <DateRangeLabel startDate={task.startDate} endDate={task.endDate} />
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
                        label={statusVisual.label}
                        statusColor={statusVisual.color}
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
  wouldCreateDependencyCycle,
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
  wouldCreateDependencyCycle: (taskId: string, dependencyId: string) => boolean;
}) {
  return (
    <section className="space-y-6">
      <h3 className="text-[14px] font-semibold text-[#71717a]">Tasks</h3>
      <div className="max-w-[300px] space-y-1">
        <Label htmlFor="milestone-task-search" className="text-[12px] font-medium text-[#71717a]">Search task:</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#b5b5ba]" />
          <Input
            id="milestone-task-search"
            value={taskSearchQuery}
            onChange={(event) => onTaskSearchQueryChange(event.target.value)}
            placeholder="Task name"
            className={taskEditIconFieldClassName}
          />
        </div>
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
        <DialogSurfaceSection className="overflow-hidden rounded-[24px] border border-black/6 bg-white p-3 shadow-[0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)]">
          {filteredProjectTasks.map(task => {
            const isLinked = linkedTaskIds.includes(task.id);
            const dependencyOptions = projectTasks.filter(
              option => option.id !== task.id && linkedTaskIds.includes(option.id)
            );
            return (
              <div
                key={task.id}
                className="border-b border-black/[0.06] px-2 py-3 last:border-b-0"
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <TaskCheckboxControl
                    checked={isLinked}
                    ariaLabel={`Link ${task.title} to this milestone`}
                    onCheckedChange={() => onToggleTask(task.id)}
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium leading-6 text-[#4a4a4f] [overflow-wrap:anywhere]">
                    {task.title}
                  </span>
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
                    wouldCreateDependencyCycle={wouldCreateDependencyCycle}
                  />
                )}
              </div>
            );
          })}
        </DialogSurfaceSection>
      )}
    </section>
  );
}

export function MilestoneDependencyEditor({
  task,
  dependencyOptions,
  selectedDependencyIds,
  onToggleDependency,
  wouldCreateDependencyCycle,
}: {
  task: Task;
  dependencyOptions: Task[];
  selectedDependencyIds: string[];
  onToggleDependency: (taskId: string, dependencyId: string) => void;
  wouldCreateDependencyCycle: (taskId: string, dependencyId: string) => boolean;
}) {
  return (
    <div className="mt-3 border-l border-[#dbe4f1] pl-7">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#7b8190]">
        Depends on
      </div>
      <div className="grid gap-1.5">
        {dependencyOptions.map(option => {
          const isSelected = selectedDependencyIds.includes(option.id);
          const createsCycle = !isSelected && wouldCreateDependencyCycle(task.id, option.id);

          return (
            <label
              key={option.id}
              className={`flex items-center gap-2 text-xs text-[#4b5563] ${
                createsCycle ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              <TaskCheckboxControl
                checked={isSelected}
                disabled={createsCycle}
                aria-label={`${task.title} depends on ${option.title}`}
                onCheckedChange={() => onToggleDependency(task.id, option.id)}
              />
              <span className="min-w-0 flex-1 truncate">{option.title}</span>
              {createsCycle && (
                <span className="group relative shrink-0">
                  <span
                    tabIndex={0}
                    aria-label="Why this dependency is blocked"
                    className="inline-flex min-h-5 items-center rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold leading-none text-[#71717a] outline-none transition-colors hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-gray-300"
                  >
                    Blocked
                  </span>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden w-max max-w-[260px] rounded-xl bg-[#303038] px-3 py-2 text-[11px] leading-4 text-white shadow-lg group-hover:block group-focus-within:block"
                  >
                    This dependency cannot be added because it would create a circular dependency chain where these tasks end up blocking each other.
                  </span>
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
