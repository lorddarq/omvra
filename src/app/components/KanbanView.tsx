/**
 * KanbanView Component
 *
 * Full-page kanban board view with independent horizontal scrolling.
 * Integrates with useViewState to preserve scroll position across view switches.
 *
 * Renders kanban columns (swimlanes) in a responsive flex layout.
 * Columns grow to fill available width or overflow-scroll if total width exceeds viewport.
 */

import { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState } from 'react';
import { Task, TaskStatus, StatusColumn, TimelineSwimlane, Person, TaskPriority } from '../types';
import { SwimlanesView } from './SwimlanesView';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Filter, Plus, Search, X } from 'lucide-react';
import {
  EMPTY_KANBAN_TASK_FILTERS,
  UNASSIGNED_ASSIGNEE_FILTER_VALUE,
  clearAllKanbanTaskFilters,
  clearKanbanTaskFilter,
  filterKanbanTasks,
  hasActiveKanbanTaskFilters,
  persistKanbanTaskFilters,
  readInitialKanbanTaskFilters,
  sanitizeKanbanTaskFilters,
  type KanbanTaskFilterKey,
  type KanbanTaskFilters,
} from '../utils/taskFilters';

const ALL_FILTER_VALUE = '__plumy_all__';
const COLUMN_DRAG_EDGE_SCROLL_ZONE = 96;
const COLUMN_DRAG_EDGE_SCROLL_STEP = 28;

const PRIORITY_FILTERS: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

interface KanbanViewProps {
  tasks: Task[];
  swimlanes: StatusColumn[];
  projects: TimelineSwimlane[];
  people: Person[];
  onTaskClick: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onReorderTasks: (tasks: Task[]) => void;
  onReorderColumns: (fromIndex: number, toIndex: number) => void;
  onRenameColumn?: (colId: string, newTitle: string) => void;
  onChangeColumnColor?: (colId: string, newColor: string) => void;
  onAddColumn?: (col: any) => void;
  onDeleteColumn?: (colId: string) => void;
}

export function KanbanView({
  tasks,
  swimlanes,
  projects,
  people,
  onTaskClick,
  onEditTask,
  onAddTask,
  onMoveTask,
  onReorderTasks,
  onReorderColumns,
  onRenameColumn,
  onChangeColumnColor,
  onAddColumn,
  onDeleteColumn,
}: KanbanViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startClientX: number; startScrollLeft: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<KanbanTaskFilters>(() =>
    readInitialKanbanTaskFilters(projects, people)
  );
  const [scrollMetrics, setScrollMetrics] = useState({
    clientWidth: 0,
    scrollWidth: 0,
    scrollLeft: 0,
  });

  const activeFilters = useMemo(
    () => sanitizeKanbanTaskFilters(filters, projects, people),
    [filters, people, projects]
  );

  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const isSearchActive = trimmedSearchQuery.length > 0;
  const hasActiveFilters = hasActiveKanbanTaskFilters(activeFilters);
  const isBoardFiltered = isSearchActive || hasActiveFilters;

  const filteredTasks = useMemo(() => {
    return filterKanbanTasks(tasks, activeFilters).filter(task => {
      if (isSearchActive) {
        const haystack = `${task.title} ${task.notes || ''}`.toLowerCase();
        if (!haystack.includes(trimmedSearchQuery)) return false;
      }

      return true;
    });
  }, [activeFilters, isSearchActive, tasks, trimmedSearchQuery]);

  useEffect(() => {
    persistKanbanTaskFilters(activeFilters);
  }, [activeFilters]);

  useEffect(() => {
    setFilters(previousFilters => {
      const nextFilters = sanitizeKanbanTaskFilters(previousFilters, projects, people);
      return JSON.stringify(previousFilters) === JSON.stringify(nextFilters)
        ? previousFilters
        : nextFilters;
    });
  }, [people, projects]);

  const projectFilterValue = activeFilters.projectId || ALL_FILTER_VALUE;
  const priorityFilterValue = activeFilters.priority || ALL_FILTER_VALUE;
  const assigneeFilterValue = activeFilters.assigneeId || ALL_FILTER_VALUE;

  const setFilterValue = (key: KanbanTaskFilterKey, value: string) => {
    setFilters(previousFilters => {
      if (value === ALL_FILTER_VALUE) {
        return clearKanbanTaskFilter(previousFilters, key);
      }

      return { ...previousFilters, [key]: value };
    });
  };

  const clearFilter = (key: KanbanTaskFilterKey) => {
    setFilters(previousFilters => clearKanbanTaskFilter(previousFilters, key));
  };

  const clearAllFilters = () => {
    setFilters(clearAllKanbanTaskFilters());
  };

  const getFilterSelectClassName = (isActive: boolean) => (
    isActive ? 'w-[150px] border-gray-400 bg-white' : 'w-[150px] bg-white'
  );

  const getPrioritySelectClassName = (isActive: boolean) => (
    isActive ? 'w-[140px] border-gray-400 bg-white' : 'w-[140px] bg-white'
  );

  const syncScrollMetrics = useCallback((node?: HTMLDivElement | null) => {
    const target = node ?? containerRef.current;
    if (!target) return;

    setScrollMetrics((previous) => {
      const next = {
        clientWidth: target.clientWidth,
        scrollWidth: target.scrollWidth,
        scrollLeft: target.scrollLeft,
      };

      if (
        previous.clientWidth === next.clientWidth &&
        previous.scrollWidth === next.scrollWidth &&
        previous.scrollLeft === next.scrollLeft
      ) {
        return previous;
      }

      return next;
    });
  }, []);

  const emitScrollState = useCallback((target: HTMLDivElement) => {
    const event = new CustomEvent('kanbanScroll', {
      detail: { scrollLeft: target.scrollLeft, scrollTop: target.scrollTop },
    });
    document.dispatchEvent(event);
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      syncScrollMetrics(e.currentTarget);
      emitScrollState(e.currentTarget);
    },
    [emitScrollState, syncScrollMetrics]
  );

  useLayoutEffect(() => {
    syncScrollMetrics();
  }, [syncScrollMetrics, swimlanes.length, filteredTasks.length, searchQuery, activeFilters]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    syncScrollMetrics(node);

    const resizeObserver = new ResizeObserver(() => {
      syncScrollMetrics(node);
    });

    resizeObserver.observe(node);
    const contentNode = node.firstElementChild;
    if (contentNode instanceof HTMLElement) {
      resizeObserver.observe(contentNode);
    }

    const handleWindowResize = () => syncScrollMetrics(node);
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [syncScrollMetrics, swimlanes.length, filteredTasks.length]);

  const hasHorizontalOverflow = scrollMetrics.scrollWidth > scrollMetrics.clientWidth + 1;
  const maxScrollLeft = Math.max(scrollMetrics.scrollWidth - scrollMetrics.clientWidth, 0);
  const thumbWidthRatio = hasHorizontalOverflow
    ? Math.max(scrollMetrics.clientWidth / scrollMetrics.scrollWidth, 0.12)
    : 1;
  const thumbWidthPercent = thumbWidthRatio * 100;
  const thumbLeftPercent = maxScrollLeft > 0
    ? (scrollMetrics.scrollLeft / maxScrollLeft) * (100 - thumbWidthPercent)
    : 0;

  const moveScrollThumb = useCallback((clientX: number) => {
    const node = containerRef.current;
    const track = scrollbarTrackRef.current;
    const dragState = dragStateRef.current;
    if (!node || !track || !dragState || maxScrollLeft <= 0) return;

    const trackRect = track.getBoundingClientRect();
    const thumbWidth = trackRect.width * thumbWidthRatio;
    const maxThumbOffset = Math.max(trackRect.width - thumbWidth, 1);
    const deltaX = clientX - dragState.startClientX;
    const scrollDelta = (deltaX / maxThumbOffset) * maxScrollLeft;

    node.scrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, dragState.startScrollLeft + scrollDelta)
    );

    syncScrollMetrics(node);
    emitScrollState(node);
  }, [emitScrollState, maxScrollLeft, syncScrollMetrics, thumbWidthRatio]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current) return;
      moveScrollThumb(event.clientX);
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [moveScrollThumb]);

  const handleTrackMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const node = containerRef.current;
    const track = scrollbarTrackRef.current;
    if (!node || !track || maxScrollLeft <= 0) return;

    const trackRect = track.getBoundingClientRect();
    const thumbWidth = trackRect.width * thumbWidthRatio;
    const clickOffset = event.clientX - trackRect.left - thumbWidth / 2;
    const maxThumbOffset = Math.max(trackRect.width - thumbWidth, 1);
    const nextRatio = Math.min(Math.max(clickOffset / maxThumbOffset, 0), 1);

    node.scrollLeft = nextRatio * maxScrollLeft;
    syncScrollMetrics(node);
    emitScrollState(node);
  }, [emitScrollState, maxScrollLeft, syncScrollMetrics, thumbWidthRatio]);

  const handleThumbMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const node = containerRef.current;
    if (!node) return;

    dragStateRef.current = {
      startClientX: event.clientX,
      startScrollLeft: node.scrollLeft,
    };
  }, []);

  const handleColumnDragHover = useCallback((clientX: number) => {
    const node = containerRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    let nextScrollLeft = node.scrollLeft;

    if (clientX < rect.left + COLUMN_DRAG_EDGE_SCROLL_ZONE) {
      nextScrollLeft -= COLUMN_DRAG_EDGE_SCROLL_STEP;
    } else if (clientX > rect.right - COLUMN_DRAG_EDGE_SCROLL_ZONE) {
      nextScrollLeft += COLUMN_DRAG_EDGE_SCROLL_STEP;
    } else {
      return;
    }

    nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, nextScrollLeft));
    if (nextScrollLeft === node.scrollLeft) return;

    node.scrollLeft = nextScrollLeft;
    syncScrollMetrics(node);
    emitScrollState(node);
  }, [emitScrollState, maxScrollLeft, syncScrollMetrics]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-gray-50">
      <div className="border-b bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks by title or details..."
              className="pl-9"
            />
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-1">
                <Select value={projectFilterValue} onValueChange={(value) => setFilterValue('projectId', value)}>
                  <SelectTrigger size="sm" className={getFilterSelectClassName(Boolean(activeFilters.projectId))}>
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>All projects</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeFilters.projectId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => clearFilter('projectId')}
                    className="size-8"
                    aria-label="Clear project filter"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Select value={priorityFilterValue} onValueChange={(value) => setFilterValue('priority', value)}>
                  <SelectTrigger size="sm" className={getPrioritySelectClassName(Boolean(activeFilters.priority))}>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>All priorities</SelectItem>
                    {PRIORITY_FILTERS.map(priority => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeFilters.priority && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => clearFilter('priority')}
                    className="size-8"
                    aria-label="Clear priority filter"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Select value={assigneeFilterValue} onValueChange={(value) => setFilterValue('assigneeId', value)}>
                  <SelectTrigger size="sm" className={getFilterSelectClassName(Boolean(activeFilters.assigneeId))}>
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>All assignees</SelectItem>
                    <SelectItem value={UNASSIGNED_ASSIGNEE_FILTER_VALUE}>Unassigned</SelectItem>
                    {people.map(person => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeFilters.assigneeId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => clearFilter('assigneeId')}
                    className="size-8"
                    aria-label="Clear assignee filter"
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
                  onClick={clearAllFilters}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Clear filters
                </Button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onAddColumn && onAddColumn({ title: 'New Column' })}
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#111111] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#222222]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Board</span>
            </button>
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="kanban-native-scrollbar-hidden min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarGutter: 'stable both-edges' }}
      >
        <SwimlanesView
          tasks={filteredTasks}
          swimlanes={swimlanes}
          isFilterActive={isBoardFiltered}
          onTaskClick={onTaskClick}
          onEditTask={onEditTask}
          onAddTask={onAddTask}
          onMoveTask={onMoveTask}
          onReorderTasks={onReorderTasks}
          onReorderColumns={onReorderColumns}
          onRenameColumn={onRenameColumn}
          onChangeColumnColor={onChangeColumnColor}
          onAddColumn={onAddColumn}
          onDeleteColumn={onDeleteColumn}
          onColumnDragHover={handleColumnDragHover}
        />
      </div>

      {hasHorizontalOverflow && (
        <div className="border-t border-gray-200 bg-white px-6 py-3">
          <div
            ref={scrollbarTrackRef}
            onMouseDown={handleTrackMouseDown}
            className="relative h-3 cursor-pointer rounded-full bg-gray-200"
          >
            <div
              onMouseDown={handleThumbMouseDown}
              className="absolute top-0 h-3 rounded-full bg-gray-500 transition-colors hover:bg-gray-600"
              style={{
                left: `${thumbLeftPercent}%`,
                width: `${thumbWidthPercent}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
