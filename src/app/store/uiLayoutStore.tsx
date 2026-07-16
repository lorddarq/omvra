import {
  createContext,
  type RefObject,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Person, ProjectMilestone, Task, TaskStatus, TimelineSwimlane } from '../types.ts';
import { useViewState, type ViewType } from '../hooks/useViewState.ts';
import { useWorkspaceDialogs } from '../hooks/useWorkspaceDialogs.ts';
import {
  DEFAULT_TIMELINE_LAYOUT_STATE,
  loadUiStateSnapshot,
  persistTimelineLayoutState,
  sanitizeViewStates,
  sanitizeTimelineLayoutState,
  type TimelineLayoutState,
} from '../services/uiState.ts';
import { EMPTY_KANBAN_TASK_FILTERS, type KanbanTaskFilters } from '../utils/taskFilters.ts';

interface ViewScrollState {
  scrollLeft: number;
  scrollTop: number;
}

interface ImportedUiStatePayload {
  currentView?: unknown;
  viewState?: Partial<Record<ViewType, unknown>>;
  timeline?: unknown;
}

interface ImportFeedbackState {
  type: 'success' | 'error';
  message: string;
}

interface UiLayoutStoreValue {
  hasHydratedUiState: boolean;
  hydratedViewStates: ReturnType<typeof sanitizeViewStates>;
  setHydratedViewStates: Dispatch<SetStateAction<ReturnType<typeof sanitizeViewStates>>>;
  timelineLayoutState: TimelineLayoutState;
  setTimelineLayoutState: Dispatch<SetStateAction<TimelineLayoutState>>;
  hydratedKanbanFilters: KanbanTaskFilters;
  setHydratedKanbanFilters: Dispatch<SetStateAction<KanbanTaskFilters>>;
  isTaskDialogOpen: boolean;
  isTaskDetailsOpen: boolean;
  isSwimlaneDialogOpen: boolean;
  isPreferencesOpen: boolean;
  preferencesInitialAnchor: string;
  selectedTask: Task | null;
  detailsTask: Task | null;
  selectedSwimlane: TimelineSwimlane | null;
  defaultStatus: TaskStatus;
  defaultDate?: Date;
  defaultEndDate?: Date;
  defaultSwimlaneId?: string;
  defaultAssigneeId?: string;
  selectedMilestone: ProjectMilestone | null;
  detailsMilestone: ProjectMilestone | null;
  isMilestoneDialogOpen: boolean;
  importFeedback: ImportFeedbackState | null;
  resetLocalDataConfirmOpen: boolean;
  currentView: ViewType;
  switchView: (view: ViewType) => void;
  getViewStateSnapshot: (view: ViewType) => ReturnType<ReturnType<typeof useViewState>['getViewState']>;
  saveActiveViewState: (view?: ViewType) => void;
  applyKanbanScrollState: (state: ViewScrollState) => void;
  setTimelineScrollState: (state: ViewScrollState) => void;
  restoreKanbanScroll: (containerRef: RefObject<HTMLDivElement | null>) => void;
  buildBackupUiState: () => {
    currentView: ViewType;
    viewState: ReturnType<typeof sanitizeViewStates>;
    timeline: TimelineLayoutState;
  };
  restoreImportedUiState: (
    payload: ImportedUiStatePayload | null | undefined,
    projects: TimelineSwimlane[],
    people: Person[]
  ) => Promise<void>;
  viewRefreshKey: number;
  bumpViewRefreshKey: () => void;
  setImportFeedback: Dispatch<SetStateAction<ImportFeedbackState | null>>;
  setResetLocalDataConfirmOpen: Dispatch<SetStateAction<boolean>>;
  openPreferences: () => void;
  closePreferences: () => void;
  openPeoplePanel: () => void;
  openAgentsPanel: () => void;
  closeTaskDetails: () => void;
  addMilestone: () => void;
  openMilestoneDetails: (milestone: ProjectMilestone) => void;
  editMilestoneFromDetails: (milestone: ProjectMilestone) => void;
  closeMilestoneDialog: () => void;
  closeMilestoneDetails: () => void;
  handleMilestoneTaskClick: (task: Task) => void;
  handleTaskClick: (task: Task) => void;
  handleEditTaskFromKanban: (task: Task) => void;
  handleEditTaskFromDetails: (task: Task) => void;
  handleAddTaskFromTimeline: (date: Date, swimlaneId: string, endDate?: Date, mode?: 'projects' | 'people') => void;
  handleAddTaskFromSwimlane: (status: TaskStatus) => void;
  handleCloseTaskDialog: () => void;
  handleEditSwimlane: (swimlane: TimelineSwimlane) => void;
  handleAddSwimlane: () => void;
  handleCloseSwimlaneDialog: () => void;
  resetUiLayoutState: () => void;
}

const UiLayoutStoreContext = createContext<UiLayoutStoreValue | null>(null);
const DEFAULT_SCROLL_STATE: ViewScrollState = { scrollLeft: 0, scrollTop: 0 };

function isViewType(value: unknown): value is ViewType {
  return value === 'timeline' || value === 'kanban' || value === 'roadmap' || value === 'loops';
}

interface UiLayoutStoreProviderProps extends PropsWithChildren {
  hasHydratedCanonicalWorkspace: boolean;
  projects: TimelineSwimlane[];
  people: Person[];
  tasks: Task[];
  milestones: ProjectMilestone[];
}

export function UiLayoutStoreProvider({
  children,
  hasHydratedCanonicalWorkspace,
  projects,
  people,
  tasks,
  milestones,
}: UiLayoutStoreProviderProps) {
  const [hydratedViewStates, setHydratedViewStates] = useState(() => sanitizeViewStates(undefined));
  const [timelineLayoutState, setTimelineLayoutState] = useState<TimelineLayoutState>(DEFAULT_TIMELINE_LAYOUT_STATE);
  const [hydratedKanbanFilters, setHydratedKanbanFilters] = useState<KanbanTaskFilters>(EMPTY_KANBAN_TASK_FILTERS);
  const [hasHydratedUiState, setHasHydratedUiState] = useState(false);
  const [viewRefreshKey, setViewRefreshKey] = useState(0);
  const [preferencesInitialAnchor, setPreferencesInitialAnchor] = useState('task-load');
  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestone | null>(null);
  const [detailsMilestoneId, setDetailsMilestoneId] = useState<string | null>(null);
  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  const [importFeedback, setImportFeedback] = useState<ImportFeedbackState | null>(null);
  const [resetLocalDataConfirmOpen, setResetLocalDataConfirmOpen] = useState(false);
  const viewState = useViewState('timeline', hydratedViewStates);
  const timelineScrollStateRef = useRef<ViewScrollState>(DEFAULT_SCROLL_STATE);
  const kanbanScrollStateRef = useRef<ViewScrollState>(DEFAULT_SCROLL_STATE);
  const dialogs = useWorkspaceDialogs(tasks);
  const detailsMilestone = detailsMilestoneId
    ? milestones.find(milestone => milestone.id === detailsMilestoneId) ?? null
    : null;

  const openPreferences = useCallback(() => {
    setPreferencesInitialAnchor('task-load');
    dialogs.setIsPreferencesOpen(true);
  }, [dialogs]);

  const closePreferences = useCallback(() => {
    dialogs.setIsPreferencesOpen(false);
  }, [dialogs]);

  const openPeoplePanel = useCallback(() => {
    setPreferencesInitialAnchor('people');
    dialogs.setIsPreferencesOpen(true);
  }, [dialogs]);

  const openAgentsPanel = useCallback(() => {
    setPreferencesInitialAnchor('agents');
    dialogs.setIsPreferencesOpen(true);
  }, [dialogs]);

  const closeTaskDetails = useCallback(() => {
    dialogs.setIsTaskDetailsOpen(false);
  }, [dialogs]);

  const addMilestone = useCallback(() => {
    setSelectedMilestone(null);
    setIsMilestoneDialogOpen(true);
  }, []);

  const openMilestoneDetails = useCallback((milestone: ProjectMilestone) => {
    setDetailsMilestoneId(milestone.id);
  }, []);

  const editMilestoneFromDetails = useCallback((milestone: ProjectMilestone) => {
    setSelectedMilestone(milestone);
    setDetailsMilestoneId(null);
    setIsMilestoneDialogOpen(true);
  }, []);

  const closeMilestoneDialog = useCallback(() => {
    setIsMilestoneDialogOpen(false);
    setSelectedMilestone(null);
  }, []);

  const closeMilestoneDetails = useCallback(() => {
    setDetailsMilestoneId(null);
  }, []);

  const handleMilestoneTaskClick = useCallback((task: Task) => {
    setDetailsMilestoneId(null);
    dialogs.handleTaskClick(task);
  }, [dialogs]);

  const setTimelineScrollState = useCallback((state: ViewScrollState) => {
    timelineScrollStateRef.current = state;
  }, []);

  const applyKanbanScrollState = useCallback((state: ViewScrollState) => {
    kanbanScrollStateRef.current = state;
    viewState.viewStatesRef.current.kanban = {
      ...viewState.viewStatesRef.current.kanban,
      scrollLeft: state.scrollLeft,
      scrollTop: state.scrollTop,
    };
  }, [viewState.viewStatesRef]);

  const getViewStateSnapshot = useCallback((view: ViewType) => {
    if (view === 'timeline') {
      return {
        ...viewState.getViewState('timeline'),
        scrollLeft: timelineScrollStateRef.current.scrollLeft,
        scrollTop: timelineScrollStateRef.current.scrollTop,
      };
    }

    if (view === 'kanban') {
      return {
        ...viewState.getViewState('kanban'),
        scrollLeft: kanbanScrollStateRef.current.scrollLeft,
        scrollTop: kanbanScrollStateRef.current.scrollTop,
      };
    }

    return view === 'roadmap'
      ? viewState.getViewState('roadmap')
      : viewState.getViewState('loops');
  }, [viewState]);

  const saveActiveViewState = useCallback((view: ViewType = viewState.currentView) => {
    viewState.saveViewState(view, getViewStateSnapshot(view));
  }, [getViewStateSnapshot, viewState]);

  const switchView = useCallback((view: ViewType) => {
    saveActiveViewState();
    viewState.switchView(view);
  }, [saveActiveViewState, viewState]);

  const restoreKanbanScroll = useCallback((containerRef: RefObject<HTMLDivElement | null>) => {
    window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      const savedState = getViewStateSnapshot('kanban');
      container.scrollLeft = savedState.scrollLeft || 0;
      container.scrollTop = savedState.scrollTop || 0;
    }, 0);
  }, [getViewStateSnapshot]);

  const buildBackupUiState = useCallback(() => ({
    currentView: viewState.currentView,
    viewState: {
      timeline: getViewStateSnapshot('timeline'),
      kanban: getViewStateSnapshot('kanban'),
      roadmap: getViewStateSnapshot('roadmap'),
      loops: getViewStateSnapshot('loops'),
    },
    timeline: timelineLayoutState,
  }), [getViewStateSnapshot, timelineLayoutState, viewState.currentView]);

  const restoreImportedUiState = useCallback(async (
    payload: ImportedUiStatePayload | null | undefined,
    nextProjects: TimelineSwimlane[],
    nextPeople: Person[]
  ) => {
    if (payload?.viewState?.timeline) {
      viewState.saveViewState('timeline', payload.viewState.timeline);
    }
    if (payload?.viewState?.kanban) {
      viewState.saveViewState('kanban', payload.viewState.kanban);
    }
    if (payload?.viewState?.roadmap) {
      viewState.saveViewState('roadmap', payload.viewState.roadmap);
    }
    if (payload?.viewState?.loops) {
      viewState.saveViewState('loops', payload.viewState.loops);
    }

    const nextLayoutState = sanitizeTimelineLayoutState(payload?.timeline);
    persistTimelineLayoutState(nextLayoutState);
    setHydratedViewStates(sanitizeViewStates(payload?.viewState));
    setTimelineLayoutState(nextLayoutState);

    const importedUiState = await loadUiStateSnapshot(nextProjects, nextPeople);
    setHydratedKanbanFilters(importedUiState.kanbanFilters);

    timelineScrollStateRef.current = {
      scrollLeft: importedUiState.viewStates.timeline.scrollLeft || 0,
      scrollTop: 0,
    };
    kanbanScrollStateRef.current = {
      scrollLeft: importedUiState.viewStates.kanban.scrollLeft || 0,
      scrollTop: importedUiState.viewStates.kanban.scrollTop || 0,
    };

    if (isViewType(payload?.currentView)) {
      viewState.switchView(payload.currentView);
    } else {
      viewState.switchView('timeline');
    }
  }, [viewState]);

  const bumpViewRefreshKey = useCallback(() => {
    setViewRefreshKey(previous => previous + 1);
  }, []);

  const resetUiLayoutState = useCallback(() => {
    setHydratedViewStates(sanitizeViewStates(undefined));
    setTimelineLayoutState(sanitizeTimelineLayoutState(undefined));
    setHydratedKanbanFilters(EMPTY_KANBAN_TASK_FILTERS);
    timelineScrollStateRef.current = DEFAULT_SCROLL_STATE;
    kanbanScrollStateRef.current = DEFAULT_SCROLL_STATE;
    viewState.resetViewState();
    viewState.switchView('timeline');
    setPreferencesInitialAnchor('task-load');
    setSelectedMilestone(null);
    setDetailsMilestoneId(null);
    setIsMilestoneDialogOpen(false);
    setImportFeedback(null);
    setResetLocalDataConfirmOpen(false);
    setViewRefreshKey(0);
    dialogs.handleCloseTaskDialog();
    dialogs.setIsTaskDetailsOpen(false);
    dialogs.setIsPreferencesOpen(false);
    dialogs.handleCloseSwimlaneDialog();
  }, [dialogs, viewState]);

  useEffect(() => {
    if (!hasHydratedCanonicalWorkspace) return;

    let cancelled = false;

    const hydrateUiState = async () => {
      try {
        const snapshot = await loadUiStateSnapshot(projects, people);
        if (cancelled) return;

        setHydratedViewStates(snapshot.viewStates);
        setTimelineLayoutState(snapshot.timelineLayout);
        setHydratedKanbanFilters(snapshot.kanbanFilters);
        timelineScrollStateRef.current = {
          scrollLeft: snapshot.viewStates.timeline.scrollLeft || 0,
          scrollTop: 0,
        };
        kanbanScrollStateRef.current = {
          scrollLeft: snapshot.viewStates.kanban.scrollLeft || 0,
          scrollTop: snapshot.viewStates.kanban.scrollTop || 0,
        };
      } finally {
        if (!cancelled) {
          setHasHydratedUiState(true);
        }
      }
    };

    void hydrateUiState();

    return () => {
      cancelled = true;
    };
  }, [hasHydratedCanonicalWorkspace, people, projects]);

  const value = useMemo<UiLayoutStoreValue>(() => ({
    hasHydratedUiState,
    hydratedViewStates,
    setHydratedViewStates,
    timelineLayoutState,
    setTimelineLayoutState,
    hydratedKanbanFilters,
    setHydratedKanbanFilters,
    isTaskDialogOpen: dialogs.isTaskDialogOpen,
    isTaskDetailsOpen: dialogs.isTaskDetailsOpen,
    isSwimlaneDialogOpen: dialogs.isSwimlaneDialogOpen,
    isPreferencesOpen: dialogs.isPreferencesOpen,
    preferencesInitialAnchor,
    selectedTask: dialogs.selectedTask,
    detailsTask: dialogs.detailsTask,
    selectedSwimlane: dialogs.selectedSwimlane,
    defaultStatus: dialogs.defaultStatus,
    defaultDate: dialogs.defaultDate,
    defaultEndDate: dialogs.defaultEndDate,
    defaultSwimlaneId: dialogs.defaultSwimlaneId,
    defaultAssigneeId: dialogs.defaultAssigneeId,
    selectedMilestone,
    detailsMilestone,
    isMilestoneDialogOpen,
    importFeedback,
    resetLocalDataConfirmOpen,
    currentView: viewState.currentView,
    switchView,
    getViewStateSnapshot,
    saveActiveViewState,
    applyKanbanScrollState,
    setTimelineScrollState,
    restoreKanbanScroll,
    buildBackupUiState,
    restoreImportedUiState,
    viewRefreshKey,
    bumpViewRefreshKey,
    setImportFeedback,
    setResetLocalDataConfirmOpen,
    openPreferences,
    closePreferences,
    openPeoplePanel,
    openAgentsPanel,
    closeTaskDetails,
    addMilestone,
    openMilestoneDetails,
    editMilestoneFromDetails,
    closeMilestoneDialog,
    closeMilestoneDetails,
    handleMilestoneTaskClick,
    handleTaskClick: dialogs.handleTaskClick,
    handleEditTaskFromKanban: dialogs.handleEditTaskFromKanban,
    handleEditTaskFromDetails: dialogs.handleEditTaskFromDetails,
    handleAddTaskFromTimeline: dialogs.handleAddTaskFromTimeline,
    handleAddTaskFromSwimlane: dialogs.handleAddTaskFromSwimlane,
    handleCloseTaskDialog: dialogs.handleCloseTaskDialog,
    handleEditSwimlane: dialogs.handleEditSwimlane,
    handleAddSwimlane: dialogs.handleAddSwimlane,
    handleCloseSwimlaneDialog: dialogs.handleCloseSwimlaneDialog,
    resetUiLayoutState,
  }), [
    applyKanbanScrollState,
    closeMilestoneDetails,
    closeMilestoneDialog,
    closePreferences,
    closeTaskDetails,
    detailsMilestone,
    dialogs.defaultAssigneeId,
    dialogs.defaultDate,
    dialogs.defaultEndDate,
    dialogs.defaultStatus,
    dialogs.defaultSwimlaneId,
    dialogs.detailsTask,
    dialogs.handleAddSwimlane,
    dialogs.handleAddTaskFromSwimlane,
    dialogs.handleAddTaskFromTimeline,
    dialogs.handleCloseSwimlaneDialog,
    dialogs.handleCloseTaskDialog,
    dialogs.handleEditSwimlane,
    dialogs.handleEditTaskFromDetails,
    dialogs.handleEditTaskFromKanban,
    dialogs.handleTaskClick,
    dialogs.isPreferencesOpen,
    dialogs.isSwimlaneDialogOpen,
    dialogs.isTaskDetailsOpen,
    dialogs.isTaskDialogOpen,
    dialogs.selectedSwimlane,
    dialogs.selectedTask,
    buildBackupUiState,
    bumpViewRefreshKey,
    editMilestoneFromDetails,
    getViewStateSnapshot,
    hasHydratedUiState,
    hydratedKanbanFilters,
    hydratedViewStates,
    importFeedback,
    isMilestoneDialogOpen,
    openAgentsPanel,
    openMilestoneDetails,
    openPeoplePanel,
    openPreferences,
    preferencesInitialAnchor,
    resetLocalDataConfirmOpen,
    restoreImportedUiState,
    restoreKanbanScroll,
    saveActiveViewState,
    selectedMilestone,
    setTimelineScrollState,
    switchView,
    timelineLayoutState,
    viewRefreshKey,
    viewState.currentView,
    addMilestone,
    handleMilestoneTaskClick,
  ]);

  return (
    <UiLayoutStoreContext.Provider value={value}>
      {children}
    </UiLayoutStoreContext.Provider>
  );
}

export function useUiLayoutStore(): UiLayoutStoreValue {
  const context = useContext(UiLayoutStoreContext);
  if (!context) {
    throw new Error('useUiLayoutStore must be used within UiLayoutStoreProvider.');
  }
  return context;
}
