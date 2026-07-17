/**
 * KanbanView Component
 *
 * Full-page kanban board view with independent horizontal scrolling.
 * Integrates with useViewState to preserve scroll position across view switches.
 *
 * Renders kanban columns (swimlanes) in a responsive flex layout.
 * Columns grow to fill available width or overflow-scroll if total width exceeds viewport.
 */

import { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState, type RefObject } from 'react';
import { Task, TaskStatus, StatusColumn, TimelineSwimlane, Person } from '../../types';
import { SwimlanesView } from './SwimlanesView';
import { ALL_FILTER_VALUE, KanbanToolbar } from '../KanbanToolbar';
import {
  clearAllKanbanTaskFilters,
  clearKanbanTaskFilter,
  filterKanbanTasks,
  hasActiveKanbanTaskFilters,
  persistKanbanTaskFilters,
  sanitizeKanbanTaskFilters,
  type KanbanTaskFilterKey,
  type KanbanTaskFilters,
} from '../../utils/taskFilters';

const COLUMN_DRAG_EDGE_SCROLL_ZONE = 96;
const COLUMN_DRAG_EDGE_SCROLL_STEP = 28;

interface KanbanViewProps {
  tasks: Task[];
  swimlanes: StatusColumn[];
  projects: TimelineSwimlane[];
  people: Person[];
  initialFilters?: KanbanTaskFilters;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  initialScrollLeft?: number;
  initialScrollTop?: number;
  onTaskClick: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onReorderTasks: (tasks: Task[]) => void;
  onReorderColumns: (fromIndex: number, toIndex: number) => void;
  onUpdateColumn?: (colId: string, updates: Partial<Omit<StatusColumn, 'id'>>) => void;
  onAddColumn?: (col: any) => void;
  onDeleteColumn?: (colId: string) => void;
}

export function KanbanView({
  tasks,
  swimlanes,
  projects,
  people,
  initialFilters,
  scrollContainerRef,
  initialScrollLeft = 0,
  initialScrollTop = 0,
  onTaskClick,
  onEditTask,
  onAddTask,
  onMoveTask,
  onReorderTasks,
  onReorderColumns,
  onUpdateColumn,
  onAddColumn,
  onDeleteColumn,
}: KanbanViewProps) {
  const fallbackContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollContainerRef ?? fallbackContainerRef;
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startClientX: number; startScrollLeft: number } | null>(null);
  const didRestoreInitialScrollRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<KanbanTaskFilters>(() =>
    sanitizeKanbanTaskFilters(initialFilters, projects, people)
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

  useEffect(() => {
    setFilters(previousFilters => {
      const nextFilters = sanitizeKanbanTaskFilters(initialFilters, projects, people);
      return JSON.stringify(previousFilters) === JSON.stringify(nextFilters)
        ? previousFilters
        : nextFilters;
    });
  }, [initialFilters, people, projects]);

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
    const node = containerRef.current;
    if (!node || didRestoreInitialScrollRef.current) return;

    node.scrollLeft = initialScrollLeft;
    node.scrollTop = initialScrollTop;
    didRestoreInitialScrollRef.current = true;
    syncScrollMetrics(node);
    emitScrollState(node);
  }, [containerRef, emitScrollState, initialScrollLeft, initialScrollTop, syncScrollMetrics]);

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
    <div className="kanban-shell">
      <KanbanToolbar
        searchQuery={searchQuery}
        projectFilterValue={projectFilterValue}
        priorityFilterValue={priorityFilterValue}
        assigneeFilterValue={assigneeFilterValue}
        hasActiveFilters={hasActiveFilters}
        activeProjectId={activeFilters.projectId}
        activePriority={activeFilters.priority}
        activeAssigneeId={activeFilters.assigneeId}
        projects={projects}
        people={people}
        onSearchQueryChange={setSearchQuery}
        onFilterValueChange={setFilterValue}
        onClearFilter={clearFilter}
        onClearAllFilters={clearAllFilters}
        onAddColumn={onAddColumn ? () => onAddColumn({ title: 'New Column' }) : undefined}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="kanban-board-scroll kanban-native-scrollbar-hidden"
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
          onUpdateColumn={onUpdateColumn}
          onAddColumn={onAddColumn}
          onDeleteColumn={onDeleteColumn}
          onColumnDragHover={handleColumnDragHover}
        />
      </div>

      {hasHorizontalOverflow && (
        <div className="kanban-scrollbar-shell">
          <div
            ref={scrollbarTrackRef}
            onMouseDown={handleTrackMouseDown}
            className="kanban-scrollbar-track"
          >
            <div
              onMouseDown={handleThumbMouseDown}
              className="kanban-scrollbar-thumb"
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
