/**
 * useViewState Hook
 *
 * Manages global app-level view state and per-view session data.
 * Enables preserving scroll position, UI state, and selections when
 * switching between views (TimelineView, KanbanView, etc.).
 *
 * Implements the virtual rendering principle: only the active view is rendered,
 * but its state is preserved in memory for instant restoration on switch.
 *
 * Usage:
 *   const viewState = useViewState();
 *   // Switch to timeline
 *   viewState.setCurrentView('timeline');
 *   // Save state on unmount
 *   viewState.saveViewState('timeline', { scrollLeft: 100, ... });
 *   // Switch to kanban
 *   viewState.setCurrentView('kanban');
 *   // Restore state on mount
 *   const savedState = viewState.getViewState('timeline');
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { deleteStoredValue, getJSON, persistJSONWithElectronMirror } from '../utils/storage';

export type ViewType = 'timeline' | 'kanban' | 'roadmap';

export interface TimelineViewState {
  scrollLeft: number;
  collapsedSwimlanes: string[];
  selectedTaskId?: string;
  selectedSwimlaneId?: string;
  mode: 'projects' | 'people';
}

export interface KanbanViewState {
  scrollLeft: number;
  scrollTop: number;
  selectedTaskId?: string;
  filterStatus?: string;
}

export interface RoadmapViewState {
  scrollLeft: number;
  scrollTop: number;
}

export type AllViewStates = {
  timeline: TimelineViewState;
  kanban: KanbanViewState;
  roadmap: RoadmapViewState;
};

/**
 * Default states for each view.
 */
const DEFAULT_STATES: AllViewStates = {
  timeline: {
    scrollLeft: 0,
    collapsedSwimlanes: [],
    mode: 'projects',
  },
  kanban: {
    scrollLeft: 0,
    scrollTop: 0,
  },
  roadmap: {
    scrollLeft: 0,
    scrollTop: 0,
  },
};

export function useViewState(initialView: ViewType = 'timeline') {
  // Currently active view
  const [currentView, setCurrentView] = useState<ViewType>(initialView);

  // Per-view session state (stored in memory, not persisted by default)
  const viewStatesRef = useRef<Record<string, Record<string, any>>>({
    timeline: { ...DEFAULT_STATES.timeline },
    kanban: { ...DEFAULT_STATES.kanban },
    roadmap: { ...DEFAULT_STATES.roadmap },
  });

  useEffect(() => {
    let cancelled = false;

    const hydrateStoredViewStates = async () => {
      const [timelineState, kanbanState, roadmapState] = await Promise.all([
        getJSON<Record<string, any>>('omvra_viewstate_timeline', null),
        getJSON<Record<string, any>>('omvra_viewstate_kanban', null),
        getJSON<Record<string, any>>('omvra_viewstate_roadmap', null),
      ]);

      if (cancelled) return;

      if (timelineState) {
        viewStatesRef.current.timeline = {
          ...DEFAULT_STATES.timeline,
          ...timelineState,
        };
      }

      if (kanbanState) {
        viewStatesRef.current.kanban = {
          ...DEFAULT_STATES.kanban,
          ...kanbanState,
        };
      }

      if (roadmapState) {
        viewStatesRef.current.roadmap = {
          ...DEFAULT_STATES.roadmap,
          ...roadmapState,
        };
      }
    };

    void hydrateStoredViewStates();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Get the current view.
   */
  const getCurrentView = useCallback(() => currentView, [currentView]);

  /**
   * Switch to a different view. Caller should save current state before switching.
   *
   * @param view - Target view (timeline | kanban)
   */
  const switchView = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, []);

  /**
   * Get saved state for a specific view.
   *
   * @param view - View to retrieve state for
   * @returns State object or default if not previously saved
   */
  const getViewState = useCallback(
    (view: ViewType): Record<string, any> => {
      return viewStatesRef.current[view];
    },
    []
  );

  /**
   * Save state for a specific view (called on unmount or before switch).
   *
   * @param view - View to save state for
   * @param state - Partial state to merge with existing
   */
  const saveViewState = useCallback(
    (view: ViewType, state: Record<string, any>) => {
      viewStatesRef.current[view] = {
        ...viewStatesRef.current[view],
        ...state,
      };

      void persistJSONWithElectronMirror(`omvra_viewstate_${view}`, viewStatesRef.current[view]);
    },
    []
  );

  /**
   * Restore state for a specific view from localStorage (if available).
   * Falls back to in-memory state or default if not found.
   *
   * @param view - View to restore state for
   */
  const restoreViewState = useCallback(
    (view: ViewType): Record<string, any> => {
      try {
        const stored = localStorage.getItem(`omvra_viewstate_${view}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          viewStatesRef.current[view] = {
            ...DEFAULT_STATES[view],
            ...parsed,
          };
        }
      } catch (e) {
        // Parse error or storage unavailable; use existing state
      }
      return viewStatesRef.current[view];
    },
    []
  );

  /**
   * Reset a view's state to defaults.
   *
   * @param view - View to reset, or undefined to reset all
   */
  const resetViewState = useCallback((view?: ViewType) => {
    if (view) {
      viewStatesRef.current[view] = { ...DEFAULT_STATES[view] };
    } else {
      viewStatesRef.current = {
        timeline: { ...DEFAULT_STATES.timeline },
        kanban: { ...DEFAULT_STATES.kanban },
        roadmap: { ...DEFAULT_STATES.roadmap },
      };
    }
  }, []);

  /**
   * Clear localStorage state for a view (for debugging or explicit reset).
   *
   * @param view - View to clear storage for
   */
  const clearStoredViewState = useCallback((view: ViewType) => {
    void deleteStoredValue(`omvra_viewstate_${view}`);
  }, []);

  return {
    // Current view
    currentView,
    getCurrentView,
    switchView,

    // State management
    getViewState,
    saveViewState,
    restoreViewState,
    resetViewState,
    clearStoredViewState,

    // Reference for direct access if needed
    viewStatesRef,
  };
}
