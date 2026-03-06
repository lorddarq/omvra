/**
 * TimelineView Component (Refactored)
 *
 * Main timeline/calendar view for task scheduling.
 * Renders swimlanes as rows with draggable tasks positioned on a date grid.
 *
 * Modular architecture:
 * - TimelineHeader: month/day headers
 * - SwimlaneRowsView: swimlane rows container
 * - DraggableSwimlaneRow: individual swimlane with tasks
 * - Track allocation: dynamic height calculation for overlapping tasks
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { Task, TimelineSwimlane, TaskStatus, Person } from '../types';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Plus } from 'lucide-react';
import { TimelineHeader } from './TimelineHeader';
import { DraggableSwimlaneLabel } from './DraggableSwimlaneLabel';
import { DraggableSwimlaneRow } from './DraggableSwimlaneRow';
import { allocateTasksToTracks, calculateSwimlaneHeight } from '../utils/trackAllocation';
import { getReadableTextClassFor } from '../utils/contrast';
import { parseISODateLocal, toLocalISODate } from '../utils/date';

const PAD_DAYS = 7;
const DEFAULT_ROW_HEIGHT = 48;
const HEADER_HEIGHT = 72;
const DEFAULT_DAY_WIDTH = 60;
const MONTH_WIDTHS_KEY = 'plumy.monthWidths.v1';
const LEFT_COL_WIDTH_KEY = 'plumy.leftColWidth.v1';
const HORIZONTAL_RENDER_BUFFER_PX = 1200;
const MIN_TOTAL_MONTHS = 12;

interface TimelineViewProps {
  tasks: Task[];
  swimlanes: TimelineSwimlane[];
  people?: Person[];
  statusColumns?: Array<{ id: TaskStatus; title: string; color?: string }>;
  initialScrollLeft?: number;
  onTaskClick: (task: Task) => void;
  onAddTask: (date: Date, swimlaneId: string, endDate?: Date, mode?: 'projects' | 'people') => void;
  onUpdateTaskDates: (taskId: string, startDate: string, endDate: string) => void;
  onEditSwimlane: (swimlane: TimelineSwimlane) => void;
  onAddSwimlane: () => void;
  onReorderSwimlanes: (swimlanes: TimelineSwimlane[]) => void;
  onReorderPeople?: (people: Person[]) => void;
  onReorderTasks: (tasks: Task[]) => void;
  onTimelineScroll?: (state: { scrollLeft: number; scrollTop: number }) => void;
}

export function TimelineView({
  tasks,
  swimlanes,
  people = [],
  statusColumns,
  initialScrollLeft,
  onTaskClick,
  onAddTask,
  onUpdateTaskDates,
  onEditSwimlane,
  onAddSwimlane,
  onReorderSwimlanes,
  onReorderPeople,
  onReorderTasks,
  onTimelineScroll,
}: TimelineViewProps) {
  // Left column width state
  const [leftColWidth, setLeftColWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 200;
    const raw = window.localStorage.getItem(LEFT_COL_WIDTH_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? Math.max(120, Math.min(480, parsed)) : 200;
  });
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const leftResizeRef = useRef<{ startX: number; startWidth: number; pendingWidth?: number } | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const monthResizeRef = useRef<{ monthKey: string; startX: number; startWidth: number } | null>(null);

  // Mode state: Projects or People
  const [mode, setMode] = useState<'projects' | 'people'>('projects');

  // Weekend visibility toggle
  const [showWeekends, setShowWeekends] = useState<boolean>(true);
  const [horizontalMetrics, setHorizontalMetrics] = useState<{ scrollLeft: number; viewportWidth: number }>({
    scrollLeft: 0,
    viewportWidth: 0,
  });

  // Display swimlanes based on mode
  const displaySwimlanes = useMemo<TimelineSwimlane[]>(() => {
    if (mode === 'people') {
      return people.map(person => ({
        id: person.id,
        name: person.name,
        subtitle: person.role,
        color: person.color || '#3b82f6', // Default blue if no color
      }));
    }
    return swimlanes;
  }, [mode, people, swimlanes]);

  // Refs
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const leftListRef = useRef<HTMLDivElement>(null);
  const fixedBtnRef = useRef<HTMLDivElement>(null);
  const hasInitializedScrollRef = useRef<boolean>(false);
  const isScrollingRef = useRef<boolean>(false); // Flag to prevent feedback loops
  const scrollNotifyRafRef = useRef<number | null>(null);
  const resizeUpdateRafRef = useRef<number | null>(null);
  const pendingDateUpdateRef = useRef<{ taskId: string; startDate: string; endDate: string } | null>(null);
  const pendingRevealDateRef = useRef<string | null>(null);
  const isHeaderScrubbingRef = useRef<boolean>(false);
  const scrubStartXRef = useRef<number>(0);
  const scrubStartScrollLeftRef = useRef<number>(0);
  const startupScrollTimersRef = useRef<number[]>([]);
  const startupScrollRafRef = useRef<number | null>(null);
  const [isHeaderScrubbing, setIsHeaderScrubbing] = useState(false);
  const [needsStartupTodayScroll, setNeedsStartupTodayScroll] = useState(false);

  // State for task resizing
  const [resizingTask, setResizingTask] = useState<{
    taskId: string;
    edge: 'start' | 'end';
    initialX: number;
    initialStartDate: string;
    initialEndDate: string;
  } | null>(null);

  // State for click suppression after resize
  const [ignoreAddTaskUntil, setIgnoreAddTaskUntil] = useState<number | null>(null);

  // Calculate full date range from tasks
  const allDates = useMemo(() => {
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const taskDates = tasks
      .flatMap(t => {
        const dates: Date[] = [];
        if (t.startDate) {
          const d = parseISODateLocal(t.startDate);
          if (d) dates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
        }
        if (t.endDate) {
          const d = parseISODateLocal(t.endDate);
          if (d) dates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
        }
        return dates;
      })
      .filter(d => !isNaN(d.getTime()));

    if (taskDates.length === 0) {
      const horizonMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + (MIN_TOTAL_MONTHS - 1), 1);
      const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
      const end = new Date(horizonMonth.getFullYear(), horizonMonth.getMonth() + 1, 0);
      const arr: Date[] = [];
      const d = new Date(start);
      while (d <= end) {
        const dayOfWeek = d.getDay();
        if (showWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
          arr.push(new Date(d));
        }
        d.setDate(d.getDate() + 1);
      }
      return arr;
    }

    const minDate = new Date(Math.min(...taskDates.map(d => d.getTime())));
    let maxDate = new Date(Math.max(...taskDates.map(d => d.getTime())));

    minDate.setDate(minDate.getDate() - PAD_DAYS);
    maxDate.setDate(maxDate.getDate() + PAD_DAYS);

    // Align to month boundaries
    let start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    let end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);

    // Ensure today is included
    const currentDate = new Date();
    const todayNoTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    if (todayNoTime < start) start = new Date(todayNoTime.getFullYear(), todayNoTime.getMonth(), 1);
    if (todayNoTime > end) end = new Date(todayNoTime.getFullYear(), todayNoTime.getMonth() + 1, 0);

    // Ensure at least a 12-month planning horizon (current month + next 11 months).
    const minForwardEnd = new Date(todayNoTime.getFullYear(), todayNoTime.getMonth() + MIN_TOTAL_MONTHS, 0);
    if (end < minForwardEnd) {
      end = minForwardEnd;
    }

    const arr: Date[] = [];
    const d = new Date(start);
    while (d <= end) {
      // Filter weekends if toggle is off (0 = Sunday, 6 = Saturday)
      const dayOfWeek = d.getDay();
      if (showWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        arr.push(new Date(d));
      }
      d.setDate(d.getDate() + 1);
    }

    return arr;
  }, [tasks, showWeekends]);

  // Group dates by month
  const allDatesByMonth = useMemo(() => {
    const m: Record<string, Date[]> = {};
    allDates.forEach(date => {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!m[monthKey]) m[monthKey] = [];
      m[monthKey].push(date);
    });
    return m;
  }, [allDates]);

  const orderedMonthKeys = useMemo(() => (
    Object.keys(allDatesByMonth).sort((a, b) => {
      const ta = allDatesByMonth[a]?.[0]?.getTime() ?? 0;
      const tb = allDatesByMonth[b]?.[0]?.getTime() ?? 0;
      return ta - tb;
    })
  ), [allDatesByMonth]);

  // Initialize month widths
  const [monthWidths, setMonthWidths] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    Object.entries(allDatesByMonth).forEach(([k, monthDates]) => {
      defaults[k] = monthDates.length * DEFAULT_DAY_WIDTH;
    });
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = window.localStorage.getItem(MONTH_WIDTHS_KEY);
      if (!raw) return defaults;
      const stored = JSON.parse(raw) as Record<string, number>;
      return { ...defaults, ...stored };
    } catch {
      return defaults;
    }
  });

  // Derive day widths
  const [allDayWidths, setAllDayWidths] = useState<number[]>(() => {
    const arr: number[] = [];
    Object.entries(allDatesByMonth).forEach(([k, monthDates]) => {
      const perDay = monthWidths[k] ? monthWidths[k] / monthDates.length : DEFAULT_DAY_WIDTH;
      monthDates.forEach(() => arr.push(perDay));
    });
    return arr;
  });

  // Update dayWidths when monthWidths changes
  useEffect(() => {
    setMonthWidths(prev => {
      const next = { ...prev };
      let changed = false;
      Object.entries(allDatesByMonth).forEach(([k, monthDates]) => {
        if (!next[k]) {
          next[k] = monthDates.length * DEFAULT_DAY_WIDTH;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [allDatesByMonth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LEFT_COL_WIDTH_KEY, String(leftColWidth));
  }, [leftColWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MONTH_WIDTHS_KEY, JSON.stringify(monthWidths));
  }, [monthWidths]);

  useEffect(() => {
    const arr: number[] = [];
    Object.entries(allDatesByMonth).forEach(([k, monthDates]) => {
      const perDay = monthWidths[k] ? monthWidths[k] / monthDates.length : DEFAULT_DAY_WIDTH;
      monthDates.forEach(() => arr.push(perDay));
    });
    setAllDayWidths(arr);
  }, [monthWidths, allDatesByMonth]);

  const monthMeta = useMemo(() => {
    const entries = orderedMonthKeys.map(monthKey => ({
      monthKey,
      width: monthWidths[monthKey] ?? (allDatesByMonth[monthKey]?.length || 0) * DEFAULT_DAY_WIDTH,
      dayCount: allDatesByMonth[monthKey]?.length || 0,
    }));

    let runningPx = 0;
    let runningDayIndex = 0;
    return entries.map(entry => {
      const meta = {
        ...entry,
        startPx: runningPx,
        endPx: runningPx + entry.width,
        startDayIndex: runningDayIndex,
      };
      runningPx += entry.width;
      runningDayIndex += entry.dayCount;
      return meta;
    });
  }, [orderedMonthKeys, monthWidths, allDatesByMonth]);

  const visibleMonthKeys = useMemo(() => {
    if (monthMeta.length === 0) return orderedMonthKeys;
    const viewportWidth = horizontalMetrics.viewportWidth || 0;
    const left = Math.max(0, horizontalMetrics.scrollLeft - HORIZONTAL_RENDER_BUFFER_PX);
    const right = horizontalMetrics.scrollLeft + viewportWidth + HORIZONTAL_RENDER_BUFFER_PX;
    const keys = monthMeta
      .filter(m => m.endPx >= left && m.startPx <= right)
      .map(m => m.monthKey);
    return keys.length > 0 ? keys : orderedMonthKeys;
  }, [monthMeta, horizontalMetrics, orderedMonthKeys]);

  const datesByMonth = useMemo(() => {
    const subset: Record<string, Date[]> = {};
    visibleMonthKeys.forEach(monthKey => {
      subset[monthKey] = allDatesByMonth[monthKey] || [];
    });
    return subset;
  }, [visibleMonthKeys, allDatesByMonth]);

  const monthStartIndices = useMemo(() => {
    const map: Record<string, number> = {};
    monthMeta.forEach(m => {
      map[m.monthKey] = m.startDayIndex;
    });
    return map;
  }, [monthMeta]);

  const leadingSpacerWidth = useMemo(() => {
    if (visibleMonthKeys.length === 0 || monthMeta.length === 0) return 0;
    const firstKey = visibleMonthKeys[0];
    const first = monthMeta.find(m => m.monthKey === firstKey);
    return first?.startPx ?? 0;
  }, [visibleMonthKeys, monthMeta]);

  const trailingSpacerWidth = useMemo(() => {
    if (visibleMonthKeys.length === 0 || monthMeta.length === 0) return 0;
    const lastKey = visibleMonthKeys[visibleMonthKeys.length - 1];
    const last = monthMeta.find(m => m.monthKey === lastKey);
    const totalWidth = monthMeta[monthMeta.length - 1].endPx;
    return Math.max(0, totalWidth - (last?.endPx ?? totalWidth));
  }, [visibleMonthKeys, monthMeta]);

  const dates = allDates;
  const dayWidths = allDayWidths;

  // Compute track assignments for each swimlane
  const swimlaneTrackAssignments = useMemo(() => {
    const assignments: Record<string, Record<string, number>> = {};
    displaySwimlanes.forEach(swimlane => {
      const swimlaneTasks = mode === 'people'
        ? tasks.filter(t => t.assigneeId === swimlane.id)
        : tasks.filter(t => t.swimlaneId === swimlane.id);
      assignments[swimlane.id] = allocateTasksToTracks(swimlaneTasks);
    });
    return assignments;
  }, [tasks, displaySwimlanes, mode]);

  // Compute dynamic heights for swimlanes
  const swimlaneHeights = useMemo(() => {
    const heights: Record<string, number> = {};
    displaySwimlanes.forEach(swimlane => {
      const swimlaneTasks = mode === 'people'
        ? tasks.filter(t => t.assigneeId === swimlane.id)
        : tasks.filter(t => t.swimlaneId === swimlane.id);
      // Each track is 40px (task render height 32px + gap 8px), with at least DEFAULT_ROW_HEIGHT
      const TRACK_HEIGHT = 40;
      const trackAssignments = allocateTasksToTracks(swimlaneTasks);
      const trackCount = swimlaneTasks.length > 0 ? Math.max(...Object.values(trackAssignments)) + 1 : 1;
      heights[swimlane.id] = Math.max(DEFAULT_ROW_HEIGHT, trackCount * TRACK_HEIGHT);
    });
    return heights;
  }, [tasks, displaySwimlanes, mode]);

  // Sync left column header height with timeline header actual height
  const [syncedHeaderHeight, setSyncedHeaderHeight] = useState<number | null>(null);
  
  useLayoutEffect(() => {
    const leftHeaderEl = document.querySelector('.left-col-header') as HTMLElement | null;
    const timelineHeaderEl = document.querySelector('.timeline-header-container') as HTMLElement | null;
    
    if (timelineHeaderEl) {
      const actualHeight = timelineHeaderEl.getBoundingClientRect().height;
      setSyncedHeaderHeight(actualHeight);
      if (leftHeaderEl) {
        leftHeaderEl.style.height = `${actualHeight}px`;
      }
    }
  }, [displaySwimlanes, tasks]);

  // Today marker
  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const todayIndex = useMemo(() => {
    if (allDates.length === 0) return -1;
    const exactIdx = allDates.findIndex(d => d.getTime() === today.getTime());
    if (exactIdx >= 0) return exactIdx;
    // In 5-day mode, weekend "today" may be filtered out; use nearest visible day.
    for (let i = 0; i < allDates.length; i++) {
      if (allDates[i].getTime() >= today.getTime()) return i;
    }
    return allDates.length - 1;
  }, [allDates, today]);

  const todayOffset = useMemo(() => {
    if (todayIndex < 0) return null;
    return dayWidths.slice(0, todayIndex).reduce((a, b) => a + b, 0);
  }, [todayIndex, dayWidths]);

  // Calculate total timeline width
  const totalTimelineWidth = useMemo(() => {
    return dayWidths.reduce((a, b) => a + b, 0);
  }, [dayWidths]);

  const endPadding = 24;

  const getVisibleIndexForDate = useCallback(
    (date: Date, mode: 'start' | 'end'): number => {
      if (dates.length === 0) return -1;
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

      if (mode === 'start') {
        for (let i = 0; i < dates.length; i++) {
          if (dates[i].getTime() >= target) return i;
        }
        return dates.length - 1;
      }

      for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i].getTime() <= target) return i;
      }
      return 0;
    },
    [dates]
  );

  const queueTaskDateUpdate = useCallback((taskId: string, startDate: string, endDate: string) => {
    pendingDateUpdateRef.current = { taskId, startDate, endDate };
    if (resizeUpdateRafRef.current == null) {
      resizeUpdateRafRef.current = requestAnimationFrame(() => {
        const pending = pendingDateUpdateRef.current;
        if (pending) {
          onUpdateTaskDates(pending.taskId, pending.startDate, pending.endDate);
        }
        pendingDateUpdateRef.current = null;
        resizeUpdateRafRef.current = null;
      });
    }
  }, [onUpdateTaskDates]);

  // Handle left column resize
  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    leftResizeRef.current = { startX: e.clientX, startWidth: leftColWidth };
  };

  useEffect(() => {
    if (!isResizingLeft) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!leftResizeRef.current) return;
      const delta = e.clientX - leftResizeRef.current.startX;
      let newWidth = Math.round(leftResizeRef.current.startWidth + delta);
      newWidth = Math.max(120, Math.min(480, newWidth));
      leftResizeRef.current.pendingWidth = newWidth;

      if (resizeRafRef.current == null) {
        resizeRafRef.current = requestAnimationFrame(() => {
          if (leftResizeRef.current) {
            setLeftColWidth(leftResizeRef.current.pendingWidth ?? leftColWidth);
            leftResizeRef.current.pendingWidth = undefined;
          }
          resizeRafRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (resizeRafRef.current != null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      setIsResizingLeft(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, leftColWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!monthResizeRef.current) return;
      const { monthKey, startX, startWidth } = monthResizeRef.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(120, startWidth + delta);
      setMonthWidths(prev => ({ ...prev, [monthKey]: newWidth }));
    };

    const handleMouseUp = () => {
      monthResizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Handle task resize with 60px grid snapping
  useEffect(() => {
    if (!resizingTask) return;

    const handleMouseMove = (e: MouseEvent) => {
      const task = tasks.find(t => t.id === resizingTask.taskId);
      if (!task) return;

      const parsedStart = parseISODateLocal(task.startDate);
      if (!parsedStart) return;
      const startDate = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate());
      const parsedEnd = parseISODateLocal(task.endDate);
      const endDate = parsedEnd
        ? new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate())
        : startDate;
      const startIdx = getVisibleIndexForDate(startDate, 'start');
      const endIdx = getVisibleIndexForDate(endDate, 'end');

      if (startIdx < 0) return;

      const prefix: number[] = [0];
      for (let i = 0; i < dayWidths.length; i++) prefix.push(prefix[i] + (dayWidths[i] ?? DEFAULT_DAY_WIDTH));

      // Use rowsContainerRef for accurate scroll position (not headerRef)
      const scrollEl = rowsContainerRef.current;
      if (!scrollEl) return;

      const rect = scrollEl.getBoundingClientRect();
      const scrollLeft = scrollEl.scrollLeft;
      const localX = e.clientX - rect.left + scrollLeft;

      // Snap to 60px grid
      const snappedX = Math.round(localX / DEFAULT_DAY_WIDTH) * DEFAULT_DAY_WIDTH;

      let newIdx = 0;
      for (let i = 0; i < prefix.length - 1; i++) {
        if (snappedX >= prefix[i] && snappedX < prefix[i + 1]) {
          newIdx = i;
          break;
        }
      }

      if (resizingTask.edge === 'start') {
        // Drag start date (can't go past end)
        if (newIdx <= endIdx && newIdx >= 0 && newIdx < dates.length) {
          const newDate = new Date(dates[newIdx]);
          const newISO = toLocalISODate(newDate);
          if (newISO !== task.startDate) {
            queueTaskDateUpdate(task.id, newISO, task.endDate || '');
          }
        }
      } else {
        // Drag end date (can't go before start)
        if (newIdx >= startIdx && newIdx >= 0 && newIdx < dates.length) {
          const newDate = new Date(dates[newIdx]);
          const newISO = toLocalISODate(newDate);
          if (newISO !== task.endDate) {
            queueTaskDateUpdate(task.id, task.startDate || '', newISO);
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (resizeUpdateRafRef.current != null) {
        cancelAnimationFrame(resizeUpdateRafRef.current);
        resizeUpdateRafRef.current = null;
      }
      const pending = pendingDateUpdateRef.current;
      if (pending) {
        onUpdateTaskDates(pending.taskId, pending.startDate, pending.endDate);
      }
      pendingDateUpdateRef.current = null;
      setResizingTask(null);
      setIgnoreAddTaskUntil(Date.now() + 300);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingTask, tasks, dates, dayWidths, onUpdateTaskDates, getVisibleIndexForDate, queueTaskDateUpdate]);

  // Scroll to today
  const scrollToToday = useCallback((opts?: { smooth?: boolean }) => {
    if (!rowsContainerRef.current) return 0;
    
    let offset = todayOffset;
    if (offset === null) {
      const todayDate = new Date();
      const todayOnly = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
      let idx = allDates.findIndex(d => d.getTime() === todayOnly.getTime());
      if (idx < 0) {
        idx = allDates.findIndex(d => d.getTime() >= todayOnly.getTime());
      }
      if (idx < 0 && allDates.length > 0) {
        idx = allDates.length - 1;
      }
      if (idx >= 0) {
        offset = dayWidths.slice(0, idx).reduce((a, b) => a + b, 0);
      }
    }
    
    if (offset === null) {
      // Default to scrolling to middle of content
      offset = Math.max(0, (totalTimelineWidth - rowsContainerRef.current.clientWidth) / 2);
    }

    const maxScrollLeft = Math.max(0, totalTimelineWidth - rowsContainerRef.current.clientWidth);
    offset = Math.max(0, Math.min(offset, maxScrollLeft));

    // Use deterministic jump to avoid smooth-scroll drift while virtualization window updates.
    rowsContainerRef.current.scrollLeft = offset;
    setHorizontalMetrics({
      scrollLeft: offset,
      viewportWidth: rowsContainerRef.current.clientWidth,
    });
    return offset;
  }, [todayOffset, allDates, dayWidths, totalTimelineWidth]);

  // Scroll handlers
  const handleScrollLeft = useCallback(() => {
    if (rowsContainerRef.current) {
      rowsContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  }, []);

  const handleScrollRight = useCallback(() => {
    if (rowsContainerRef.current) {
      rowsContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  }, []);

  // Sync scroll between header and rows container
  const handleHeaderScroll = useCallback(() => {
    // Header is now inside rowsContainer, no need to sync
  }, []);

  const handleRowsScroll = useCallback(() => {
    // All scrolling happens on rowsContainer now
  }, []);

  // Attach scroll listeners
  useEffect(() => {
    // No longer need horizontal sync since header is within rowsContainer
  }, []);

  // Decide initial horizontal position only once per mount.
  useEffect(() => {
    if (hasInitializedScrollRef.current) return;
    hasInitializedScrollRef.current = true;

    // Restore saved view position only when it's meaningful; otherwise lock startup to today.
    if (
      typeof initialScrollLeft === 'number' &&
      initialScrollLeft > 0 &&
      rowsContainerRef.current
    ) {
      rowsContainerRef.current.scrollLeft = initialScrollLeft;
      setHorizontalMetrics({
        scrollLeft: initialScrollLeft,
        viewportWidth: rowsContainerRef.current.clientWidth,
      });
      setNeedsStartupTodayScroll(false);
    } else {
      setNeedsStartupTodayScroll(true);
    }

    return () => {
      if (startupScrollRafRef.current != null) {
        cancelAnimationFrame(startupScrollRafRef.current);
        startupScrollRafRef.current = null;
      }
      startupScrollTimersRef.current.forEach(id => clearTimeout(id));
      startupScrollTimersRef.current = [];
    };
  }, [initialScrollLeft]);

  // Cold-start guard: keep nudging to Today until the timeline width/virtual window stabilizes.
  useEffect(() => {
    if (!needsStartupTodayScroll) return;

    let cancelled = false;
    let attempts = 0;
    let stableHits = 0;
    const MAX_ATTEMPTS = 40; // ~4s with 100ms cadence

    const applyTodayUntilStable = () => {
      if (cancelled || !rowsContainerRef.current) return;

      attempts += 1;
      const target = scrollToToday({ smooth: false });
      const actual = rowsContainerRef.current.scrollLeft;
      const widthSettled = rowsContainerRef.current.scrollWidth > rowsContainerRef.current.clientWidth;
      const aligned = Math.abs(actual - target) <= 1;
      const canFinishAtZero = target <= 1 || !widthSettled;

      if (aligned && (canFinishAtZero || actual > 1)) {
        stableHits += 1;
      } else {
        stableHits = 0;
      }

      if (stableHits >= 2 || attempts >= MAX_ATTEMPTS) {
        setNeedsStartupTodayScroll(false);
        return;
      }

      const id = window.setTimeout(applyTodayUntilStable, 100);
      startupScrollTimersRef.current.push(id);
    };

    startupScrollRafRef.current = requestAnimationFrame(() => {
      applyTodayUntilStable();
    });

    return () => {
      cancelled = true;
      if (startupScrollRafRef.current != null) {
        cancelAnimationFrame(startupScrollRafRef.current);
        startupScrollRafRef.current = null;
      }
      startupScrollTimersRef.current.forEach(id => clearTimeout(id));
      startupScrollTimersRef.current = [];
    };
  }, [needsStartupTodayScroll, scrollToToday, totalTimelineWidth, dayWidths.length, allDates.length]);

  // Day-header hand scrubbing (click-drag to pan timeline horizontally)
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isHeaderScrubbingRef.current || !rowsContainerRef.current) return;
      const dx = e.clientX - scrubStartXRef.current;
      rowsContainerRef.current.scrollLeft = scrubStartScrollLeftRef.current - dx;
      setHorizontalMetrics({
        scrollLeft: rowsContainerRef.current.scrollLeft,
        viewportWidth: rowsContainerRef.current.clientWidth,
      });
      e.preventDefault();
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

  // Swimlane reordering
  const handleMoveSwimlane = useCallback((dragIndex: number, hoverIndex: number) => {
    if (mode === 'people') {
      const newPeople = [...people];
      const [draggedPerson] = newPeople.splice(dragIndex, 1);
      newPeople.splice(hoverIndex, 0, draggedPerson);
      onReorderPeople?.(newPeople);
    } else {
      const newSwimlanes = [...swimlanes];
      const [draggedSwim] = newSwimlanes.splice(dragIndex, 1);
      newSwimlanes.splice(hoverIndex, 0, draggedSwim);
      onReorderSwimlanes(newSwimlanes);
    }
  }, [mode, people, swimlanes, onReorderPeople, onReorderSwimlanes]);

  // Sync vertical scroll between left column and rows container
  const handleLeftScroll = useCallback(() => {
    if (!leftListRef.current || !rowsContainerRef.current || isScrollingRef.current) return;
    isScrollingRef.current = true;
    rowsContainerRef.current.scrollTop = leftListRef.current.scrollTop;
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 0);
  }, []);

  const handleRowsVerticalScroll = useCallback(() => {
    if (!leftListRef.current || !rowsContainerRef.current || isScrollingRef.current) return;
    isScrollingRef.current = true;
    leftListRef.current.scrollTop = rowsContainerRef.current.scrollTop;
    if (scrollNotifyRafRef.current == null) {
      scrollNotifyRafRef.current = requestAnimationFrame(() => {
        if (rowsContainerRef.current) {
          const nextMetrics = {
            scrollLeft: rowsContainerRef.current.scrollLeft,
            viewportWidth: rowsContainerRef.current.clientWidth,
          };
          setHorizontalMetrics(nextMetrics);
          onTimelineScroll?.({
            scrollLeft: nextMetrics.scrollLeft,
            scrollTop: rowsContainerRef.current.scrollTop,
          });
        }
        scrollNotifyRafRef.current = null;
      });
    }
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 0);
  }, [onTimelineScroll]);

  // Attach vertical scroll listeners
  useEffect(() => {
    const leftEl = leftListRef.current;
    const rowsEl = rowsContainerRef.current;
    if (!leftEl || !rowsEl) return;

    leftEl.addEventListener('scroll', handleLeftScroll);
    rowsEl.addEventListener('scroll', handleRowsVerticalScroll);
    return () => {
      if (scrollNotifyRafRef.current != null) {
        cancelAnimationFrame(scrollNotifyRafRef.current);
        scrollNotifyRafRef.current = null;
      }
      leftEl.removeEventListener('scroll', handleLeftScroll);
      rowsEl.removeEventListener('scroll', handleRowsVerticalScroll);
    };
  }, [handleLeftScroll, handleRowsVerticalScroll]);

  useEffect(() => {
    if (!rowsContainerRef.current) return;
    setHorizontalMetrics({
      scrollLeft: rowsContainerRef.current.scrollLeft,
      viewportWidth: rowsContainerRef.current.clientWidth,
    });
  }, [dayWidths.length, leftColWidth, showWeekends]);

  useEffect(() => {
    const pendingISO = pendingRevealDateRef.current;
    if (!pendingISO || !rowsContainerRef.current || dates.length === 0 || dayWidths.length === 0) return;

    const revealDate = parseISODateLocal(pendingISO);
    if (!revealDate || isNaN(revealDate.getTime())) {
      pendingRevealDateRef.current = null;
      return;
    }

    const idx = getVisibleIndexForDate(revealDate, 'start');
    if (idx < 0) return;

    const left = dayWidths.slice(0, idx).reduce((a, b) => a + b, 0);
    const target = Math.max(0, left - rowsContainerRef.current.clientWidth * 0.25);
    try {
      rowsContainerRef.current.scrollTo({ left: target, behavior: 'smooth' });
    } catch {
      rowsContainerRef.current.scrollLeft = target;
    }

    pendingRevealDateRef.current = null;
  }, [dates, dayWidths, getVisibleIndexForDate]);

  // Get task color helper with fallback for orphaned statuses
  const getTaskColor = useCallback(
    (status: string): { className?: string; style?: React.CSSProperties } => {
      const col = statusColumns?.find(c => c.id === status);
      if (col) {
        const bgColor = col.color || '#e5e7eb';
        const textClass = getReadableTextClassFor(bgColor);
        return {
          className: textClass,
          style: { backgroundColor: bgColor },
        };
      }
      // Fallback for orphaned statuses (use first available column or gray)
      if (statusColumns && statusColumns.length > 0) {
        const fallbackCol = statusColumns[0];
        const bgColor = fallbackCol.color || '#e5e7eb';
        const textClass = getReadableTextClassFor(bgColor);
        return {
          className: textClass,
          style: { backgroundColor: bgColor },
        };
      }
      // Last resort fallback
      const defaultColor = '#e5e7eb';
      const textClass = getReadableTextClassFor(defaultColor);
      return {
        className: textClass,
        style: { backgroundColor: defaultColor },
      };
    },
    [statusColumns]
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div ref={timelineContainerRef} className="timeline-container">
        {/* Header with controls */}
        <div className="timeline-toolbar">
          <h3 className="timeline-toolbar-title">Timeline</h3>
          <button onClick={handleScrollLeft} className="timeline-toolbar-button">
            ◀
          </button>
          <button onClick={() => scrollToToday({ smooth: false })} className="timeline-toolbar-button-primary">
            Today
          </button>
          <button onClick={handleScrollRight} className="timeline-toolbar-button">
            ▶
          </button>

          {/* Weekend toggle */}
          <button
            onClick={() => setShowWeekends(!showWeekends)}
            className={`px-3 py-1 text-sm rounded font-medium transition-all ${
              showWeekends
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
            title={showWeekends ? 'Hide weekends' : 'Show weekends'}
          >
            {showWeekends ? '7 days' : '5 days'}
          </button>
          
          {/* Mode toggle */}
          <div className="ml-auto flex items-center gap-1 bg-gray-100 p-1 rounded-md">
            <button
              onClick={() => setMode('projects')}
              className={`px-3 py-1 text-sm rounded-sm font-medium transition-all ${
                mode === 'projects'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => setMode('people')}
              className={`px-3 py-1 text-sm rounded-sm font-medium transition-all ${
                mode === 'people'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              People
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="timeline-main-content">
          {/* Left column: swimlane labels */}
          <div className="timeline-left-column" style={{ width: `${leftColWidth}px` }}>
            {/* Combined header matching month + day header height */}
            <div className="timeline-left-header">
              <span className="timeline-left-header-title">
                {mode === 'people' ? 'People' : 'Swimlanes'}
              </span>
              {mode === 'projects' && (
                <button onClick={onAddSwimlane} className="timeline-left-header-button">
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <div
                role="separator"
                aria-orientation="vertical"
                onMouseDown={handleLeftResizeStart}
                className="timeline-left-resize-handle"
              />
            </div>

            <div className="timeline-left-list" ref={leftListRef}>
              {displaySwimlanes.map((swimlane, index) => {
                const height = swimlaneHeights[swimlane.id] || DEFAULT_ROW_HEIGHT;
                const taskCount = mode === 'people'
                  ? tasks.filter(t => t.assigneeId === swimlane.id).length
                  : tasks.filter(t => t.swimlaneId === swimlane.id).length;
                
                return (
                  <div key={swimlane.id} className="timeline-swimlane-label-container" style={{ height: `${height}px`, minHeight: `${height}px` }}>
                    <DraggableSwimlaneLabel
                      swimlane={swimlane}
                      index={index}
                      leftColWidth={leftColWidth}
                      rowHeight={height}
                      onEditSwimlane={mode === 'projects' ? onEditSwimlane : () => {}}
                      onMoveSwimlane={handleMoveSwimlane}
                      mode={mode}
                      taskCount={taskCount}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column: timeline */}
          <div ref={rowsContainerRef} className="timeline-right-column">
            <div className="timeline-grid-container" style={{ minWidth: `${totalTimelineWidth + endPadding}px` }}>
              {/* Header: months and days - sticky at top */}
              <div
                className={`timeline-header-container ${isHeaderScrubbing ? 'scrubbing' : ''}`}
                style={{ height: 'fit-content', minHeight: `${HEADER_HEIGHT}px`, overflow: 'visible' }}
                onMouseDown={(e) => {
                  if (e.button !== 0 || !rowsContainerRef.current) return;
                  const target = e.target as HTMLElement;
                  const scrubZone = target.closest('.timeline-day-scrub-handle');
                  const blockedTarget = target.closest('button, a, input, textarea, select, [role="separator"]');
                  if (!scrubZone || blockedTarget) return;

                  isHeaderScrubbingRef.current = true;
                  setIsHeaderScrubbing(true);
                  scrubStartXRef.current = e.clientX;
                  scrubStartScrollLeftRef.current = rowsContainerRef.current.scrollLeft;
                  e.preventDefault();
                }}
              >
              <TimelineHeader
                datesByMonth={datesByMonth}
                monthKeys={visibleMonthKeys}
                monthStartIndices={monthStartIndices}
                monthWidths={monthWidths}
                dayWidths={dayWidths}
                defaultDayWidth={DEFAULT_DAY_WIDTH}
                totalTimelineWidth={totalTimelineWidth}
                endPadding={endPadding}
                leadingSpacerWidth={leadingSpacerWidth}
                trailingSpacerWidth={trailingSpacerWidth}
                rowHeight={DEFAULT_ROW_HEIGHT}
                swimlaneCount={displaySwimlanes.length}
                todayOffset={todayOffset}
                highlightToday={true}
                headerRef={headerRef}
                onMonthResizeStart={(monthKey, e) => {
                  e.preventDefault();
                  monthResizeRef.current = {
                    monthKey,
                    startX: e.clientX,
                    startWidth: monthWidths[monthKey] || DEFAULT_DAY_WIDTH,
                  };
                }}
                onMonthReset={(monthKey) => {
                  const monthDates = datesByMonth[monthKey] || [];
                  setMonthWidths(prev => ({
                    ...prev,
                    [monthKey]: monthDates.length * DEFAULT_DAY_WIDTH,
                  }));
                }}
              />
            </div>

            {/* Swimlane rows: tasks */}
            <div className="timeline-rows-container">
              {displaySwimlanes.map((swimlane, idx) => {
                const swimlaneTasks = mode === 'people'
                  ? tasks.filter(t => t.assigneeId === swimlane.id)
                  : tasks.filter(t => t.swimlaneId === swimlane.id);
                const height = swimlaneHeights[swimlane.id] || DEFAULT_ROW_HEIGHT;

                return (
                  <div
                    key={swimlane.id}
                    className="swimlane-row relative"
                    style={{ height: `${height}px`, minHeight: `${height}px` }}
                  >
                    <DraggableSwimlaneRow
                      swimlane={swimlane}
                      index={idx}
                      mode={mode}
                      tasks={swimlaneTasks}
                      dates={dates}
                      dateWidths={dayWidths}
                      monthKeys={visibleMonthKeys}
                      monthWidths={monthWidths}
                      datesByMonth={datesByMonth}
                      leadingSpacerWidth={leadingSpacerWidth}
                      trailingSpacerWidth={trailingSpacerWidth + endPadding}
                      totalTimelineWidth={totalTimelineWidth}
                      rowHeight={height}
                      onTaskClick={onTaskClick}
                      onAddTask={(date, swimlaneId, endDate) => onAddTask(date, swimlaneId, endDate, mode)}
                      onEditSwimlane={onEditSwimlane}
                      onMoveSwimlane={handleMoveSwimlane}
                      onMoveTaskToSwimlane={(taskId, swimlaneId, newStartDate, newEndDate) => {
                        const task = tasks.find(t => t.id === taskId);
                        if (task) {
                          // Update swimlane/assignee and dates if provided
                          const updated = { ...task };
                          if (mode === 'people') {
                            updated.assigneeId = swimlaneId;
                          } else {
                            updated.swimlaneId = swimlaneId;
                          }
                          if (newStartDate) updated.startDate = newStartDate;
                          if (newEndDate) updated.endDate = newEndDate;
                          
                          // Update the task in the state
                          onReorderTasks(tasks.map(t => (t.id === taskId ? updated : t)));
                        }
                      }}
                      onRevealDate={(dateISO) => {
                        pendingRevealDateRef.current = dateISO;
                      }}
                      getTaskColor={getTaskColor}
                      handleResizeStart={(e, task, edge) => {
                        setResizingTask({
                          taskId: task.id,
                          edge,
                          initialX: e.clientX,
                          initialStartDate: task.startDate || '',
                          initialEndDate: task.endDate || '',
                        });
                      }}
                      resizingTaskId={resizingTask?.taskId ?? null}
                      ignoreAddTaskUntil={ignoreAddTaskUntil}
                      scrollContainerRef={rowsContainerRef}
                    />
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
}
