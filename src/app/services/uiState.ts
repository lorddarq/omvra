import type { TimelineSwimlane, Person } from '../types.ts';
import type { AllViewStates, ViewType } from '../hooks/useViewState.ts';
import {
  DEFAULT_STATES,
  type KanbanViewState,
  type RoadmapViewState,
  type TimelineViewState,
} from '../hooks/useViewState.ts';
import {
  EMPTY_KANBAN_TASK_FILTERS,
  sanitizeKanbanTaskFilters,
  type KanbanTaskFilters,
} from '../utils/taskFilters.ts';
import { getJSON, persistJSONWithElectronMirror } from '../utils/storage.ts';

export const TIMELINE_VIEW_STATE_KEY = 'omvra_viewstate_timeline';
export const KANBAN_VIEW_STATE_KEY = 'omvra_viewstate_kanban';
export const ROADMAP_VIEW_STATE_KEY = 'omvra_viewstate_roadmap';
export const TIMELINE_MONTH_WIDTHS_KEY = 'omvra.monthWidths.v1';
export const TIMELINE_LEFT_COL_WIDTH_KEY = 'omvra.leftColWidth.v1';

const DEFAULT_TIMELINE_LEFT_COL_WIDTH = 282;
const MIN_TIMELINE_LEFT_COL_WIDTH = 260;
const MAX_TIMELINE_LEFT_COL_WIDTH = 420;

export interface TimelineLayoutState {
  leftColWidth: number;
  monthWidths: Record<string, number>;
}

export interface UiStateSnapshot {
  viewStates: AllViewStates;
  timelineLayout: TimelineLayoutState;
  kanbanFilters: KanbanTaskFilters;
}

export const DEFAULT_TIMELINE_LAYOUT_STATE: TimelineLayoutState = {
  leftColWidth: DEFAULT_TIMELINE_LEFT_COL_WIDTH,
  monthWidths: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeTimelineViewState(value: unknown): TimelineViewState {
  if (!isRecord(value)) return { ...DEFAULT_STATES.timeline };
  return {
    ...DEFAULT_STATES.timeline,
    scrollLeft: Number.isFinite(Number(value.scrollLeft)) ? Number(value.scrollLeft) : DEFAULT_STATES.timeline.scrollLeft,
    collapsedSwimlanes: Array.isArray(value.collapsedSwimlanes) ? value.collapsedSwimlanes.map(String) : [],
    selectedTaskId: typeof value.selectedTaskId === 'string' ? value.selectedTaskId : undefined,
    selectedSwimlaneId: typeof value.selectedSwimlaneId === 'string' ? value.selectedSwimlaneId : undefined,
    mode: value.mode === 'people' ? 'people' : 'projects',
  };
}

function sanitizeKanbanViewState(value: unknown): KanbanViewState {
  if (!isRecord(value)) return { ...DEFAULT_STATES.kanban };
  return {
    ...DEFAULT_STATES.kanban,
    scrollLeft: Number.isFinite(Number(value.scrollLeft)) ? Number(value.scrollLeft) : DEFAULT_STATES.kanban.scrollLeft,
    scrollTop: Number.isFinite(Number(value.scrollTop)) ? Number(value.scrollTop) : DEFAULT_STATES.kanban.scrollTop,
    selectedTaskId: typeof value.selectedTaskId === 'string' ? value.selectedTaskId : undefined,
    filterStatus: typeof value.filterStatus === 'string' ? value.filterStatus : undefined,
  };
}

function sanitizeRoadmapViewState(value: unknown): RoadmapViewState {
  if (!isRecord(value)) return { ...DEFAULT_STATES.roadmap };
  return {
    ...DEFAULT_STATES.roadmap,
    scrollLeft: Number.isFinite(Number(value.scrollLeft)) ? Number(value.scrollLeft) : DEFAULT_STATES.roadmap.scrollLeft,
    scrollTop: Number.isFinite(Number(value.scrollTop)) ? Number(value.scrollTop) : DEFAULT_STATES.roadmap.scrollTop,
  };
}

export function sanitizeViewStates(value: Partial<Record<ViewType, unknown>> | null | undefined): AllViewStates {
  return {
    timeline: sanitizeTimelineViewState(value?.timeline),
    kanban: sanitizeKanbanViewState(value?.kanban),
    roadmap: sanitizeRoadmapViewState(value?.roadmap),
  };
}

export function sanitizeTimelineLayoutState(value: unknown): TimelineLayoutState {
  if (!isRecord(value)) return { ...DEFAULT_TIMELINE_LAYOUT_STATE };

  const monthWidths = isRecord(value.monthWidths)
    ? Object.fromEntries(
        Object.entries(value.monthWidths).reduce<Array<[string, number]>>((acc, [key, width]) => {
          if (typeof key === 'string' && Number.isFinite(Number(width)) && Number(width) > 0) {
            acc.push([key, Number(width)]);
          }
          return acc;
        }, [])
      )
    : {};

  const rawLeftColWidth = Number(value.leftColWidth);
  const leftColWidth = Number.isFinite(rawLeftColWidth)
    ? Math.max(MIN_TIMELINE_LEFT_COL_WIDTH, Math.min(MAX_TIMELINE_LEFT_COL_WIDTH, rawLeftColWidth))
    : DEFAULT_TIMELINE_LAYOUT_STATE.leftColWidth;

  return {
    leftColWidth,
    monthWidths,
  };
}

export async function loadUiStateSnapshot(
  projects: TimelineSwimlane[],
  people: Person[]
): Promise<UiStateSnapshot> {
  const [timelineState, kanbanState, roadmapState, leftColWidth, monthWidths, kanbanFilters] = await Promise.all([
    getJSON<Record<string, unknown>>(TIMELINE_VIEW_STATE_KEY, null),
    getJSON<Record<string, unknown>>(KANBAN_VIEW_STATE_KEY, null),
    getJSON<Record<string, unknown>>(ROADMAP_VIEW_STATE_KEY, null),
    getJSON<number>(TIMELINE_LEFT_COL_WIDTH_KEY, null),
    getJSON<Record<string, number>>(TIMELINE_MONTH_WIDTHS_KEY, null),
    getJSON<unknown>('omvra.filters.v1', null),
  ]);

  return {
    viewStates: sanitizeViewStates({
      timeline: timelineState,
      kanban: kanbanState,
      roadmap: roadmapState,
    }),
    timelineLayout: sanitizeTimelineLayoutState({
      leftColWidth,
      monthWidths,
    }),
    kanbanFilters: sanitizeKanbanTaskFilters(kanbanFilters, projects, people),
  };
}

export function persistTimelineLayoutState(layout: TimelineLayoutState): void {
  persistJSONWithElectronMirror(TIMELINE_LEFT_COL_WIDTH_KEY, layout.leftColWidth);
  persistJSONWithElectronMirror(TIMELINE_MONTH_WIDTHS_KEY, layout.monthWidths);
}
