import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Filter, Plus, Search, TriangleAlert, X } from 'lucide-react';
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
  height: number;
}

const DAY_WIDTH = 52;
const LEFT_WIDTH = 280;
const HEADER_HEIGHT = 82;
const MILESTONE_ROW_HEIGHT = 52;
const TASK_ROW_HEIGHT = 48;
const MILESTONE_ROW_GAP = 0;
const CHART_PADDING_BOTTOM = 24;

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

function getStatusColorProps(
  statusColumns: RoadmapViewProps['statusColumns'],
  status: TaskStatus
): { className?: string; style?: CSSProperties } {
  const color = statusColumns.find(column => column.id === status)?.color;

  if (color?.startsWith('#')) {
    return { style: { backgroundColor: color } };
  }

  if (color) {
    return { className: color };
  }

  return { style: { backgroundColor: '#d1d5db' } };
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

function getRoadmapRowHeight(taskCount: number): number {
  return MILESTONE_ROW_HEIGHT + Math.max(1, taskCount) * TASK_ROW_HEIGHT + MILESTONE_ROW_GAP;
}

function MilestoneRollupBar({
  counts,
  totalTasks,
  statusColumns,
}: {
  counts: Record<TaskStatus, number>;
  totalTasks: number;
  statusColumns: RoadmapViewProps['statusColumns'];
}) {
  if (totalTasks === 0) {
    return <div className="h-2 rounded-full bg-gray-100" aria-label="No linked tasks" />;
  }

  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-gray-100" aria-label="Milestone task status composition">
      {statusColumns.map(column => {
        const status = column.id;
        const count = counts[status] || 0;
        if (count === 0) return null;
        const colorProps = getStatusColorProps(statusColumns, status);
        return (
          <div
            key={status}
            className={colorProps.className}
            style={{
              ...colorProps.style,
              width: `${(count / totalTasks) * 100}%`,
            }}
            title={`${count} ${getStatusTitle(statusColumns, status)} task${count === 1 ? '' : 's'}`}
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
  const chartViewportRef = useRef<HTMLDivElement>(null);
  const isHeaderScrubbingRef = useRef(false);
  const scrubStartXRef = useRef(0);
  const scrubStartScrollLeftRef = useRef(0);
  const autoScrolledRangeRef = useRef<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState<MilestoneHealth | 'all'>('all');
  const [dateWindow, setDateWindow] = useState<RoadmapDateWindow>('all');
  const [isHeaderScrubbing, setIsHeaderScrubbing] = useState(false);
  const [chartScrollLeft, setChartScrollLeft] = useState(0);
  const [chartScrollTop, setChartScrollTop] = useState(0);
  const [chartViewportHeight, setChartViewportHeight] = useState(0);
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
  const rowSummaries = useMemo(() => {
    return filteredMilestones.map(milestone => {
      const enrichedMilestone = enrichedMilestoneById?.get(milestone.id);
      const summary = enrichedMilestone?.summary ?? summarizeMilestone(milestone, tasks);
      return {
        milestone,
        projects: enrichedMilestone?.projects
          ?? projects.filter(project => getMilestoneProjectIds(milestone).includes(project.id)),
        summary,
      };
    });
  }, [enrichedMilestoneById, filteredMilestones, projects, tasks]);
  const rows = useMemo<RoadmapRow[]>(() => {
    const availableRowsHeight = Math.max(0, chartViewportHeight - HEADER_HEIGHT);
    const baseHeights = rowSummaries.map(row => getRoadmapRowHeight(row.summary.linkedTasks.length));
    const totalBaseHeight = baseHeights.reduce((total, height) => total + height, 0);
    const extraHeightPerRow = rowSummaries.length > 0 && totalBaseHeight < availableRowsHeight
      ? (availableRowsHeight - totalBaseHeight) / rowSummaries.length
      : 0;
    let top = HEADER_HEIGHT;

    return rowSummaries.map((row, index) => {
      const height = baseHeights[index] + extraHeightPerRow;
      const positionedRow = {
        ...row,
        top,
        height,
      };
      top += height;
      return positionedRow;
    });
  }, [chartViewportHeight, rowSummaries]);
  const timelineWidth = allDates.length * DAY_WIDTH;
  const chartContentHeight = rows.length === 0
    ? 360
    : rows[rows.length - 1].top + rows[rows.length - 1].height;
  const chartHeight = rows.length === 0
    ? 360
    : Math.max(
        chartViewportHeight,
        chartContentHeight + (chartContentHeight > chartViewportHeight ? CHART_PADDING_BOTTOM : 0)
      );
  const todayIndex = daysBetween(range.start, startOfDay(new Date()));
  const todayLeft = todayIndex >= 0 && todayIndex < allDates.length ? todayIndex * DAY_WIDTH + DAY_WIDTH / 2 : null;

  const resetFilters = () => {
    setSearchQuery('');
    setProjectFilter('all');
    setHealthFilter('all');
    setDateWindow('all');
  };

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

  useLayoutEffect(() => {
    const viewportNode = chartViewportRef.current;
    if (!viewportNode) return;

    const updateViewportHeight = () => {
      setChartViewportHeight(viewportNode.clientHeight);
    };
    updateViewportHeight();

    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(viewportNode);

    return () => {
      observer.disconnect();
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

  const handleChartScroll = () => {
    const nextScrollLeft = chartScrollRef.current?.scrollLeft || 0;
    const nextScrollTop = chartScrollRef.current?.scrollTop || 0;
    setChartScrollLeft(currentScrollLeft => (
      currentScrollLeft === nextScrollLeft ? currentScrollLeft : nextScrollLeft
    ));
    setChartScrollTop(currentScrollTop => (
      currentScrollTop === nextScrollTop ? currentScrollTop : nextScrollTop
    ));
  };

  const scrollToDay = (date: Date, behavior: ScrollBehavior = 'smooth') => {
    if (!chartScrollRef.current) return;
    const dayIndex = daysBetween(range.start, startOfDay(date));
    if (dayIndex < 0 || dayIndex >= allDates.length) return;

    const viewportWidth = chartScrollRef.current.clientWidth;
    const dayCenter = dayIndex * DAY_WIDTH + DAY_WIDTH / 2;
    const targetLeft = dayCenter - viewportWidth / 2;
    chartScrollRef.current.scrollTo({
      left: Math.max(0, targetLeft),
      behavior,
    });
  };

  const scrollToToday = () => {
    scrollToDay(new Date(), 'auto');
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
      <div className="kanban-toolbar">
        <div className="kanban-toolbar-search">
          <Search className="kanban-toolbar-search-icon" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search milestones, projects, or linked tasks..."
            className="kanban-toolbar-search-input"
          />
        </div>
        <div className="roadmap-toolbar-center" aria-label="Roadmap date navigation">
          <span className="roadmap-toolbar-date-range">
            {toLocalISODate(range.start)} to {toLocalISODate(range.end)}
          </span>
          {todayLeft !== null && (
            <button
              type="button"
              onClick={scrollToToday}
              className="timeline-toolbar-button-primary"
            >
              Today
            </button>
          )}
        </div>
        <div className="kanban-toolbar-actions">
          <div className="kanban-filter-control">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger size="sm" className={`kanban-filter-trigger ${projectFilter !== 'all' ? 'is-active' : ''}`}>
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
                className="kanban-filter-clear"
                aria-label="Clear project filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="kanban-filter-control">
            <Select
              value={healthFilter}
              onValueChange={(value) => setHealthFilter(value as MilestoneHealth | 'all')}
            >
              <SelectTrigger size="sm" className={`kanban-filter-trigger ${healthFilter !== 'all' ? 'is-active' : ''}`}>
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
                className="kanban-filter-clear"
                aria-label="Clear health filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="kanban-filter-control">
            <Select
              value={dateWindow}
              onValueChange={(value) => setDateWindow(value as RoadmapDateWindow)}
            >
              <SelectTrigger size="sm" className={`kanban-filter-trigger ${dateWindow !== 'all' ? 'is-active' : ''}`}>
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
                className="kanban-filter-clear"
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
              className="kanban-toolbar-clear"
            >
              <Filter className="h-4 w-4" />
              Clear
            </Button>
          )}
          <button
            type="button"
            onClick={onAddMilestone}
            className="kanban-toolbar-add-board"
          >
            <Plus className="size-4" />
            <span>Add milestone</span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">

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
          <section className="flex h-full min-h-0 flex-col overflow-hidden border-t border-gray-200 bg-white">
            <div ref={chartViewportRef} className="relative min-h-0 flex-1 overflow-hidden">
              <div
                className={`absolute inset-x-0 top-0 z-50 h-[82px] select-none border-b border-gray-200 bg-white ${
                  isHeaderScrubbing ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                onMouseDown={handleHeaderScrubStart}
              >
                <div
                  className="absolute left-0 top-0 z-10 border-r border-gray-200 bg-white"
                  style={{ width: LEFT_WIDTH, height: HEADER_HEIGHT }}
                >
                  <div className="px-4 py-4 text-sm font-semibold text-gray-900">Milestones</div>
                </div>
                <div
                  className="absolute top-0"
                  style={{
                    left: LEFT_WIDTH,
                    width: timelineWidth,
                    height: HEADER_HEIGHT,
                    transform: `translate3d(${-chartScrollLeft}px, 0, 0)`,
                  }}
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
                </div>
              </div>

              <div className="absolute bottom-0 left-0 top-[82px] z-40 overflow-hidden border-r border-gray-200 bg-white" style={{ width: LEFT_WIDTH }}>
                <div
                  className="relative"
                  style={{
                    height: Math.max(0, chartHeight - HEADER_HEIGHT),
                    transform: `translate3d(0, ${-chartScrollTop}px, 0)`,
                  }}
                >
                  {rows.map(row => (
                    <button
                      key={row.milestone.id}
                      type="button"
                      onClick={() => onMilestoneClick(row.milestone)}
                      className="absolute left-0 flex w-full flex-col gap-2 border-t border-gray-200 bg-white px-4 py-4 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
                      style={{ top: row.top - HEADER_HEIGHT, height: row.height }}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: row.milestone.color || row.projects[0]?.color || '#6b7280' }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 truncate text-sm font-semibold text-gray-950">{row.milestone.title}</span>
                      </div>
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        <Badge variant="outline" className="max-w-full truncate text-gray-600">
                          {row.projects.length > 0
                            ? row.projects.map(project => project.name).join(', ')
                            : 'Unknown project'}
                        </Badge>
                        <Badge className={HEALTH_CLASSES[row.summary.health]} variant="outline">
                          {HEALTH_LABELS[row.summary.health]}
                        </Badge>
                      </div>
                      <MilestoneRollupBar
                        counts={row.summary.counts}
                        totalTasks={row.summary.totalTasks}
                        statusColumns={statusColumns}
                      />
                      <div className="text-xs text-gray-500">
                        {row.summary.completedTasks} of {row.summary.totalTasks} tasks done
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div ref={chartScrollRef} className="absolute bottom-0 right-0 top-0 overflow-auto" style={{ left: LEFT_WIDTH }} onScroll={handleChartScroll}>
                <div
                  className="relative"
                  style={{
                    width: timelineWidth,
                    height: chartHeight,
                  }}
                >
                <div
                  className="absolute"
                  style={{ left: 0, top: HEADER_HEIGHT, width: timelineWidth, height: chartHeight - HEADER_HEIGHT }}
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
                    style={{ left: todayLeft, top: HEADER_HEIGHT, height: chartHeight - HEADER_HEIGHT }}
                  >
                    <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-gray-900" />
                  </div>
                )}

                <svg
                  className="pointer-events-none absolute z-10"
                  style={{ left: 0, top: HEADER_HEIGHT, width: timelineWidth, height: chartHeight - HEADER_HEIGHT }}
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
                        className="absolute border-t border-gray-200"
                        style={{ left: 0, top: row.top, width: timelineWidth, height: row.height }}
                      >
                        <button
                          type="button"
                          onClick={() => onMilestoneClick(row.milestone)}
                          className="absolute top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
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
                          const statusColorProps = getStatusColorProps(statusColumns, task.status);
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
                                className={`absolute inset-y-0 left-0 opacity-45 ${statusColorProps.className || ''}`}
                                style={{
                                  ...statusColorProps.style,
                                  width: `${progress}%`,
                                }}
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
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
