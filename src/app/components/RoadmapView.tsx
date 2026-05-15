import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Filter, Plus, Search, TriangleAlert, X } from 'lucide-react';
import { ProjectMilestone, Task, TaskStatus, TimelineSwimlane } from '../types';
import {
  getMilestoneProjectIds,
  summarizeMilestone,
  type MilestoneHealth,
} from '../utils/roadmap';
import { parseISODateLocal, toLocalISODate } from '../utils/date';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface RoadmapViewProps {
  milestones: ProjectMilestone[];
  tasks: Task[];
  projects: TimelineSwimlane[];
  statusColumns: Array<{ id: TaskStatus; title: string; color?: string }>;
  readModel?: WorkspaceReadModel;
  onAddMilestone: () => void;
  onMilestoneClick: (milestone: ProjectMilestone) => void;
  onTaskClick: (task: Task) => void;
}

type RoadmapDateWindow = 'all' | '30' | '90' | 'overdue';

interface RoadmapRow {
  milestone: ProjectMilestone;
  projects: TimelineSwimlane[];
  summary: ReturnType<typeof summarizeMilestone>;
  top: number;
}

const DAY_WIDTH = 52;
const LEFT_WIDTH = 280;
const HEADER_HEIGHT = 82;
const MILESTONE_ROW_HEIGHT = 52;
const TASK_ROW_HEIGHT = 48;
const CHART_PADDING_BOTTOM = 24;

const STATUS_SEGMENT_CLASSES: Record<TaskStatus, string> = {
  open: 'bg-gray-300',
  'in-progress': 'bg-blue-500',
  'under-review': 'bg-amber-500',
  done: 'bg-emerald-500',
};

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

function getStatusTitle(statusColumns: RoadmapViewProps['statusColumns'], status: TaskStatus): string {
  return statusColumns.find(column => column.id === status)?.title || status;
}

function getTaskProgress(status: TaskStatus): number {
  if (status === 'done') return 100;
  if (status === 'under-review') return 80;
  if (status === 'in-progress') return 45;
  return 15;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function isMilestoneInDateWindow(milestone: ProjectMilestone, dateWindow: RoadmapDateWindow): boolean {
  if (dateWindow === 'all') return true;
  const milestoneEnd = parseISODateLocal(milestone.endDate);
  if (!milestoneEnd) return false;

  const today = startOfDay(new Date());

  if (dateWindow === 'overdue') {
    return milestoneEnd.getTime() < today.getTime();
  }

  const windowEnd = addDays(today, Number(dateWindow));
  return milestoneEnd.getTime() >= today.getTime() && milestoneEnd.getTime() <= windowEnd.getTime();
}

function getDateRange(milestones: ProjectMilestone[], tasks: Task[]): { start: Date; end: Date } {
  const dates: Date[] = [];

  milestones.forEach(milestone => {
    const start = milestone.startDate ? parseISODateLocal(milestone.startDate) : null;
    const end = parseISODateLocal(milestone.endDate);
    if (start) dates.push(start);
    if (end) dates.push(end);

    const linkedTaskIds = new Set(milestone.linkedTaskIds || []);
    tasks.forEach(task => {
      if (task.milestoneId !== milestone.id && !linkedTaskIds.has(task.id)) return;
      const taskStart = task.startDate ? parseISODateLocal(task.startDate) : null;
      const taskEnd = task.endDate ? parseISODateLocal(task.endDate) : null;
      if (taskStart) dates.push(taskStart);
      if (taskEnd) dates.push(taskEnd);
    });
  });

  const today = startOfDay(new Date());
  dates.push(today);

  if (dates.length === 0) {
    return { start: addDays(today, -7), end: addDays(today, 90) };
  }

  const min = new Date(Math.min(...dates.map(date => startOfDay(date).getTime())));
  const max = new Date(Math.max(...dates.map(date => startOfDay(date).getTime())));
  return {
    start: addDays(min, -7),
    end: addDays(max, 14),
  };
}

function getTaskLeft(task: Task, timelineStart: Date): number {
  const taskStart = task.startDate ? parseISODateLocal(task.startDate) : null;
  return Math.max(0, daysBetween(timelineStart, taskStart || timelineStart) * DAY_WIDTH);
}

function getTaskWidth(task: Task): number {
  const taskStart = task.startDate ? parseISODateLocal(task.startDate) : null;
  const taskEnd = task.endDate ? parseISODateLocal(task.endDate) : taskStart;
  if (!taskStart || !taskEnd) return DAY_WIDTH * 2;
  return Math.max(DAY_WIDTH * 1.5, (daysBetween(taskStart, taskEnd) + 1) * DAY_WIDTH);
}

function sortRoadmapTasks(tasks: Task[]): Task[] {
  const sortedByDate = [...tasks].sort((a, b) => {
    const dateCompare = (a.startDate || '').localeCompare(b.startDate || '');
    if (dateCompare !== 0) return dateCompare;
    return a.title.localeCompare(b.title);
  });
  const taskById = new Map(sortedByDate.map(task => [task.id, task]));
  const visitedTaskIds = new Set<string>();
  const visitingTaskIds = new Set<string>();
  const orderedTasks: Task[] = [];

  const visit = (task: Task) => {
    if (visitedTaskIds.has(task.id)) return;
    if (visitingTaskIds.has(task.id)) {
      orderedTasks.push(task);
      visitedTaskIds.add(task.id);
      return;
    }

    visitingTaskIds.add(task.id);
    (task.dependencyIds || []).forEach(dependencyId => {
      const dependencyTask = taskById.get(dependencyId);
      if (dependencyTask) visit(dependencyTask);
    });
    visitingTaskIds.delete(task.id);

    if (!visitedTaskIds.has(task.id)) {
      visitedTaskIds.add(task.id);
      orderedTasks.push(task);
    }
  };

  sortedByDate.forEach(visit);
  return orderedTasks;
}

function MilestoneRollupBar({
  counts,
  totalTasks,
}: {
  counts: Record<TaskStatus, number>;
  totalTasks: number;
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
            title={`${count} ${status} task${count === 1 ? '' : 's'}`}
          />
        );
      })}
    </div>
  );
}

export function RoadmapView({
  milestones,
  tasks,
  projects,
  statusColumns,
  readModel,
  onAddMilestone,
  onMilestoneClick,
  onTaskClick,
}: RoadmapViewProps) {
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const isHeaderScrubbingRef = useRef(false);
  const scrubStartXRef = useRef(0);
  const scrubStartScrollLeftRef = useRef(0);
  const autoScrolledRangeRef = useRef<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState<MilestoneHealth | 'all'>('all');
  const [dateWindow, setDateWindow] = useState<RoadmapDateWindow>('all');
  const [isHeaderScrubbing, setIsHeaderScrubbing] = useState(false);
  const enrichedMilestoneById = readModel?.milestonesById;

  const filteredMilestones = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return milestones
      .filter(milestone => {
        if (!normalizedSearch) return true;
        const enrichedMilestone = enrichedMilestoneById?.get(milestone.id);
        const milestoneProjects = enrichedMilestone?.projects
          ?? projects.filter(project => getMilestoneProjectIds(milestone).includes(project.id));
        const summary = enrichedMilestone?.summary ?? summarizeMilestone(milestone, tasks);
        const searchableText = [
          milestone.title,
          milestone.notes,
          ...milestoneProjects.map(project => project.name),
          ...summary.linkedTasks.map(task => `${task.title} ${task.notes || ''}`),
        ].join(' ').toLowerCase();
        return searchableText.includes(normalizedSearch);
      })
      .filter(milestone => {
        if (projectFilter === 'all') return true;
        const enrichedMilestone = enrichedMilestoneById?.get(milestone.id);
        return enrichedMilestone
          ? enrichedMilestone.projects.some(project => project.id === projectFilter)
          : getMilestoneProjectIds(milestone).includes(projectFilter);
      })
      .filter(milestone => {
        const summary = enrichedMilestoneById?.get(milestone.id)?.summary ?? summarizeMilestone(milestone, tasks);
        return healthFilter === 'all' || summary.health === healthFilter;
      })
      .filter(milestone => isMilestoneInDateWindow(milestone, dateWindow))
      .sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [dateWindow, enrichedMilestoneById, healthFilter, milestones, projectFilter, projects, searchQuery, tasks]);

  const hasActiveFilters = searchQuery.trim() !== '' || projectFilter !== 'all' || healthFilter !== 'all' || dateWindow !== 'all';
  const range = useMemo(() => getDateRange(filteredMilestones, tasks), [filteredMilestones, tasks]);
  const allDates = useMemo(() => {
    const days = Math.max(1, daysBetween(range.start, range.end) + 1);
    return Array.from({ length: days }, (_, index) => addDays(range.start, index));
  }, [range.end, range.start]);
  const monthGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; startIndex: number; days: number }> = [];
    allDates.forEach((date, index) => {
      const key = getMonthKey(date);
      const existing = groups[groups.length - 1];
      if (existing?.key === key) {
        existing.days += 1;
        return;
      }
      groups.push({
        key,
        label: date.toLocaleString(undefined, { month: 'long' }),
        startIndex: index,
        days: 1,
      });
    });
    return groups;
  }, [allDates]);
  const rows = useMemo<RoadmapRow[]>(() => {
    let top = HEADER_HEIGHT;
    return filteredMilestones.map(milestone => {
      const enrichedMilestone = enrichedMilestoneById?.get(milestone.id);
      const summary = enrichedMilestone?.summary ?? summarizeMilestone(milestone, tasks);
      const row = {
        milestone,
        projects: enrichedMilestone?.projects
          ?? projects.filter(project => getMilestoneProjectIds(milestone).includes(project.id)),
        summary,
        top,
      };
      top += MILESTONE_ROW_HEIGHT + Math.max(1, summary.linkedTasks.length) * TASK_ROW_HEIGHT + 14;
      return row;
    });
  }, [enrichedMilestoneById, filteredMilestones, projects, tasks]);
  const timelineWidth = allDates.length * DAY_WIDTH;
  const chartHeight = rows.length === 0
    ? 360
    : rows[rows.length - 1].top + MILESTONE_ROW_HEIGHT + Math.max(1, rows[rows.length - 1].summary.linkedTasks.length) * TASK_ROW_HEIGHT + CHART_PADDING_BOTTOM;
  const todayIndex = daysBetween(range.start, startOfDay(new Date()));
  const todayLeft = todayIndex >= 0 && todayIndex < allDates.length ? todayIndex * DAY_WIDTH + DAY_WIDTH / 2 : null;

  const resetFilters = () => {
    setSearchQuery('');
    setProjectFilter('all');
    setHealthFilter('all');
    setDateWindow('all');
  };

  const getFilterSelectClassName = (isActive: boolean) => (
    isActive ? 'w-[150px] border-gray-400 bg-white' : 'w-[150px] bg-white'
  );

  const getDateSelectClassName = (isActive: boolean) => (
    isActive ? 'w-[140px] border-gray-400 bg-white' : 'w-[140px] bg-white'
  );

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!isHeaderScrubbingRef.current || !chartScrollRef.current) return;
      const dx = event.clientX - scrubStartXRef.current;
      chartScrollRef.current.scrollLeft = scrubStartScrollLeftRef.current - dx;
      event.preventDefault();
    };

    const handleUp = () => {
      if (!isHeaderScrubbingRef.current) return;
      isHeaderScrubbingRef.current = false;
      setIsHeaderScrubbing(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const handleHeaderScrubStart = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || !chartScrollRef.current) return;
    const target = event.target as HTMLElement;
    const blockedTarget = target.closest('button, a, input, textarea, select, [role="button"]');
    if (blockedTarget) return;

    isHeaderScrubbingRef.current = true;
    setIsHeaderScrubbing(true);
    scrubStartXRef.current = event.clientX;
    scrubStartScrollLeftRef.current = chartScrollRef.current.scrollLeft;
    event.preventDefault();
  };

  const scrollToDay = (date: Date, behavior: ScrollBehavior = 'smooth') => {
    if (!chartScrollRef.current) return;
    const dayIndex = daysBetween(range.start, startOfDay(date));
    if (dayIndex < 0 || dayIndex >= allDates.length) return;

    const viewportWidth = chartScrollRef.current.clientWidth;
    const targetLeft = LEFT_WIDTH + dayIndex * DAY_WIDTH + DAY_WIDTH / 2 - viewportWidth / 2;
    chartScrollRef.current.scrollTo({
      left: Math.max(0, targetLeft),
      behavior,
    });
  };

  const scrollToToday = () => {
    scrollToDay(new Date());
  };

  useLayoutEffect(() => {
    if (todayLeft === null) return;
    const rangeKey = `${toLocalISODate(range.start)}:${toLocalISODate(range.end)}:${timelineWidth}`;
    if (autoScrolledRangeRef.current === rangeKey) return;

    autoScrolledRangeRef.current = rangeKey;
    const animationFrame = window.requestAnimationFrame(() => {
      scrollToDay(new Date(), 'auto');
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [range.end, range.start, timelineWidth, todayLeft]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-gray-50">
      <div className="border-b bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search milestones, projects, or linked tasks..."
              className="pl-9"
            />
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-1">
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger size="sm" className={getFilterSelectClassName(projectFilter !== 'all')}>
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All projects</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {projectFilter !== 'all' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setProjectFilter('all')}
                    className="size-8"
                    aria-label="Clear project filter"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Select
                  value={healthFilter}
                  onValueChange={(value) => setHealthFilter(value as MilestoneHealth | 'all')}
                >
                  <SelectTrigger size="sm" className={getFilterSelectClassName(healthFilter !== 'all')}>
                    <SelectValue placeholder="Health" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All health</SelectItem>
                    {(Object.keys(HEALTH_LABELS) as MilestoneHealth[]).map(health => (
                      <SelectItem key={health} value={health}>
                        {HEALTH_LABELS[health]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {healthFilter !== 'all' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setHealthFilter('all')}
                    className="size-8"
                    aria-label="Clear health filter"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Select
                  value={dateWindow}
                  onValueChange={(value) => setDateWindow(value as RoadmapDateWindow)}
                >
                  <SelectTrigger size="sm" className={getDateSelectClassName(dateWindow !== 'all')}>
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All dates</SelectItem>
                    <SelectItem value="30">Next 30 days</SelectItem>
                    <SelectItem value="90">Next 90 days</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                {dateWindow !== 'all' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDateWindow('all')}
                    className="size-8"
                    aria-label="Clear date filter"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Clear filters
                </Button>
              )}
            </div>
            <Button onClick={onAddMilestone}>
              <Plus className="size-4" />
              Add milestone
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">

        {milestones.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-950">No roadmap milestones yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
              Create a milestone to group task work around a project delivery point, then track composition and date risk here.
            </p>
            <Button onClick={onAddMilestone} className="mt-5">
              Create first milestone
            </Button>
          </section>
        ) : filteredMilestones.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-950">No milestones match these filters</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
              Adjust the project, health, or date filters to bring milestones back into view.
            </p>
            <Button onClick={resetFilters} variant="outline" className="mt-5">
              Reset filters
            </Button>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="text-sm text-gray-600">
                Showing {filteredMilestones.length} of {milestones.length} milestone{milestones.length === 1 ? '' : 's'}
              </div>
              <div className="flex items-center gap-2">
                {todayLeft !== null && (
                  <Button type="button" variant="outline" size="sm" onClick={scrollToToday}>
                    Today
                  </Button>
                )}
                <Badge variant="outline" className="gap-1.5 text-gray-600">
                  <CalendarDays className="size-3.5" />
                  {toLocalISODate(range.start)} to {toLocalISODate(range.end)}
                </Badge>
              </div>
            </div>

            <div ref={chartScrollRef} className="overflow-auto">
              <div
                className="relative"
                style={{
                  width: LEFT_WIDTH + timelineWidth,
                  height: chartHeight,
                }}
              >
                <div
                  className={`sticky left-0 top-0 z-40 select-none border-r border-gray-200 bg-white ${
                    isHeaderScrubbing ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
                  style={{ width: LEFT_WIDTH, height: HEADER_HEIGHT }}
                  onMouseDown={handleHeaderScrubStart}
                >
                  <div className="px-4 py-4 text-sm font-semibold text-gray-900">Milestones</div>
                </div>

                <div
                  className={`absolute top-0 z-30 select-none border-b border-gray-200 bg-white ${
                    isHeaderScrubbing ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
                  style={{ left: LEFT_WIDTH, width: timelineWidth, height: HEADER_HEIGHT }}
                  onMouseDown={handleHeaderScrubStart}
                >
                  {monthGroups.map(month => (
                    <div
                      key={month.key}
                      className="absolute top-0 flex h-10 items-center border-r border-gray-100 px-3 text-sm font-semibold text-gray-900"
                      style={{
                        left: month.startIndex * DAY_WIDTH,
                        width: month.days * DAY_WIDTH,
                      }}
                    >
                      {month.label}
                    </div>
                  ))}
                  {allDates.map((date, index) => {
                    const isToday = todayLeft !== null && index === todayIndex;
                    return (
                      <div
                        key={date.toISOString()}
                        className="absolute top-10 flex h-10 items-center justify-center border-r border-gray-100 text-xs text-gray-500"
                        style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}
                      >
                        <span className={isToday ? 'rounded-md bg-gray-900 px-2 py-1 font-medium text-white' : ''}>
                          {String(date.getDate()).padStart(2, '0')}
                        </span>
                      </div>
                    );
                  })}
                  {todayLeft !== null && (
                    <button
                      type="button"
                      onClick={scrollToToday}
                      className="absolute right-3 top-3 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
                      aria-label="Today marker"
                    >
                      Today
                    </button>
                  )}
                </div>

                <div
                  className="absolute"
                  style={{ left: LEFT_WIDTH, top: HEADER_HEIGHT, width: timelineWidth, height: chartHeight - HEADER_HEIGHT }}
                >
                  {allDates.map((date, index) => (
                    <div
                      key={date.toISOString()}
                      className={date.getDay() === 0 || date.getDay() === 6 ? 'absolute top-0 h-full bg-gray-50' : 'absolute top-0 h-full border-r border-gray-100'}
                      style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}
                    />
                  ))}
                </div>

                {todayLeft !== null && (
                  <div
                    className="absolute z-10 w-px bg-gray-900"
                    style={{ left: LEFT_WIDTH + todayLeft, top: HEADER_HEIGHT, height: chartHeight - HEADER_HEIGHT }}
                  >
                    <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-gray-900" />
                  </div>
                )}

                <svg
                  className="pointer-events-none absolute z-10"
                  style={{ left: LEFT_WIDTH, top: HEADER_HEIGHT, width: timelineWidth, height: chartHeight - HEADER_HEIGHT }}
                >
                  <defs>
                    <marker id="roadmap-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                      <path d="M0,0 L8,4 L0,8 Z" fill="#4b5563" />
                    </marker>
                  </defs>
                  {rows.flatMap(row => {
                    const sortedTasks = sortRoadmapTasks(row.summary.linkedTasks);
                    const taskById = new Map(sortedTasks.map(task => [task.id, task]));
                    const taskIndexById = new Map(sortedTasks.map((task, index) => [task.id, index]));
                    return sortedTasks.flatMap(task =>
                      (task.dependencyIds || [])
                        .filter(dependencyId => taskById.has(dependencyId))
                        .map(dependencyId => {
                      const dependencyTask = taskById.get(dependencyId) as Task;
                      const dependencyIndex = taskIndexById.get(dependencyId) || 0;
                      const taskIndex = taskIndexById.get(task.id) || 0;
                      const fromX = getTaskLeft(dependencyTask, range.start) + getTaskWidth(dependencyTask);
                      const toX = getTaskLeft(task, range.start);
                      const fromY = row.top - HEADER_HEIGHT + MILESTONE_ROW_HEIGHT + dependencyIndex * TASK_ROW_HEIGHT + 23;
                      const toY = row.top - HEADER_HEIGHT + MILESTONE_ROW_HEIGHT + taskIndex * TASK_ROW_HEIGHT + 23;
                      const elbowX = Math.max(fromX + 12, Math.min(toX - 12, fromX + 36));
                      return (
                        <path
                          key={`${row.milestone.id}-${dependencyId}-${task.id}`}
                          d={`M ${fromX} ${fromY} H ${elbowX} V ${toY} H ${toX - 8}`}
                          fill="none"
                          stroke="#4b5563"
                          strokeWidth="1.5"
                          markerEnd="url(#roadmap-arrow)"
                        />
                      );
                        })
                    );
                  })}
                </svg>

                {rows.map(row => {
                  const milestoneLeft = daysBetween(range.start, parseISODateLocal(row.milestone.endDate) || range.start) * DAY_WIDTH + DAY_WIDTH / 2;
                  const lateTaskIds = new Set(row.summary.lateTasks.map(task => task.id));
                  const sortedTasks = sortRoadmapTasks(row.summary.linkedTasks);

                  return (
                    <div key={row.milestone.id}>
                      <div
                        className="sticky left-0 z-40 border-r border-t border-gray-200 bg-white"
                        style={{ top: row.top, width: LEFT_WIDTH, height: MILESTONE_ROW_HEIGHT + Math.max(1, sortedTasks.length) * TASK_ROW_HEIGHT }}
                      >
                        <button
                          type="button"
                          onClick={() => onMilestoneClick(row.milestone)}
                          className="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="size-3 rounded-full"
                              style={{ backgroundColor: row.milestone.color || row.projects[0]?.color || '#6b7280' }}
                              aria-hidden="true"
                            />
                            <span className="truncate text-sm font-semibold text-gray-950">{row.milestone.title}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="max-w-full truncate text-gray-600">
                              {row.projects.length > 0
                                ? row.projects.map(project => project.name).join(', ')
                                : 'Unknown project'}
                            </Badge>
                            <Badge className={HEALTH_CLASSES[row.summary.health]} variant="outline">
                              {HEALTH_LABELS[row.summary.health]}
                            </Badge>
                          </div>
                          <MilestoneRollupBar counts={row.summary.counts} totalTasks={row.summary.totalTasks} />
                          <div className="text-xs text-gray-500">
                            {row.summary.completedTasks} of {row.summary.totalTasks} tasks done
                          </div>
                        </button>
                      </div>

                      <div
                        className="absolute border-t border-gray-200"
                        style={{ left: LEFT_WIDTH, top: row.top, width: timelineWidth, height: MILESTONE_ROW_HEIGHT + Math.max(1, sortedTasks.length) * TASK_ROW_HEIGHT }}
                      >
                        <button
                          type="button"
                          onClick={() => onMilestoneClick(row.milestone)}
                          className="absolute top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
                          style={{ left: milestoneLeft }}
                        >
                          <span
                            className="size-2 rotate-45"
                            style={{ backgroundColor: row.milestone.color || row.projects[0]?.color || '#6b7280' }}
                          />
                          {row.milestone.title}
                        </button>

                        {sortedTasks.length === 0 ? (
                          <div className="absolute left-4 top-[64px] text-sm text-gray-500">No linked tasks yet.</div>
                        ) : sortedTasks.map((task, index) => {
                          const left = getTaskLeft(task, range.start);
                          const width = getTaskWidth(task);
                          const progress = getTaskProgress(task.status);
                          const isLate = lateTaskIds.has(task.id);
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => onTaskClick(task)}
                              className={`absolute z-20 flex h-8 items-center overflow-hidden rounded-md border bg-white text-left text-sm shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 ${
                                isLate ? 'border-red-300' : 'border-gray-300'
                              }`}
                              style={{
                                left,
                                top: MILESTONE_ROW_HEIGHT + index * TASK_ROW_HEIGHT + 9,
                                width,
                              }}
                              title={`${task.title} - ${getStatusTitle(statusColumns, task.status)}`}
                            >
                              <span
                                className={`absolute inset-y-0 left-0 ${STATUS_SEGMENT_CLASSES[task.status]} opacity-45`}
                                style={{ width: `${progress}%` }}
                                aria-hidden="true"
                              />
                              <span className="relative z-10 truncate px-3 text-gray-900">{task.title}</span>
                              {isLate && (
                                <span className="relative z-10 ml-auto pr-2 text-red-700">
                                  <TriangleAlert className="size-3.5" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
