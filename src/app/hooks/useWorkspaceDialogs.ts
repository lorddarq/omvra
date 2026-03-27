import { useCallback, useMemo, useState } from 'react';
import { Task, TaskStatus, TimelineSwimlane } from '../types';

export function useWorkspaceDialogs(tasks: Task[]) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [isSwimlaneDialogOpen, setIsSwimlaneDialogOpen] = useState(false);
  const [isPeoplePanelOpen, setIsPeoplePanelOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [selectedSwimlane, setSelectedSwimlane] = useState<TimelineSwimlane | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('open');
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [defaultEndDate, setDefaultEndDate] = useState<Date | undefined>(undefined);
  const [defaultSwimlaneId, setDefaultSwimlaneId] = useState<string | undefined>(undefined);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | undefined>(undefined);

  const detailsTask = useMemo(
    () => (detailsTaskId ? tasks.find(t => t.id === detailsTaskId) ?? null : null),
    [detailsTaskId, tasks]
  );

  const handleTaskClick = useCallback((task: Task) => {
    setDetailsTaskId(task.id);
    setIsTaskDetailsOpen(true);
  }, []);

  const handleEditTaskFromKanban = useCallback((task: Task) => {
    setSelectedTask(task);
    setDefaultStatus(task.status);
    setDefaultDate(undefined);
    setDefaultSwimlaneId(task.swimlaneId);
    setIsTaskDialogOpen(true);
  }, []);

  const handleEditTaskFromDetails = useCallback((task: Task) => {
    setIsTaskDetailsOpen(false);
    setSelectedTask(task);
    setDefaultStatus(task.status);
    setDefaultDate(undefined);
    setDefaultSwimlaneId(task.swimlaneId);
    setIsTaskDialogOpen(true);
  }, []);

  const handleAddTaskFromTimeline = useCallback((
    date: Date,
    swimlaneId: string,
    endDate?: Date,
    mode?: 'projects' | 'people'
  ) => {
    setSelectedTask(null);
    setDefaultStatus('open');
    setDefaultDate(date);
    setDefaultEndDate(endDate);
    if (mode === 'people') {
      setDefaultSwimlaneId(undefined);
      setDefaultAssigneeId(swimlaneId);
    } else {
      setDefaultSwimlaneId(swimlaneId);
      setDefaultAssigneeId(undefined);
    }
    setIsTaskDialogOpen(true);
  }, []);

  const handleAddTaskFromSwimlane = useCallback((status: TaskStatus) => {
    setSelectedTask(null);
    setDefaultStatus(status);
    setDefaultDate(undefined);
    setDefaultSwimlaneId(undefined);
    setIsTaskDialogOpen(true);
  }, []);

  const handleCloseTaskDialog = useCallback(() => {
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
    setDefaultDate(undefined);
    setDefaultEndDate(undefined);
    setDefaultSwimlaneId(undefined);
    setDefaultAssigneeId(undefined);
  }, []);

  const handleEditSwimlane = useCallback((swimlane: TimelineSwimlane) => {
    setSelectedSwimlane(swimlane);
    setIsSwimlaneDialogOpen(true);
  }, []);

  const handleAddSwimlane = useCallback(() => {
    setSelectedSwimlane(null);
    setIsSwimlaneDialogOpen(true);
  }, []);

  const handleCloseSwimlaneDialog = useCallback(() => {
    setIsSwimlaneDialogOpen(false);
    setSelectedSwimlane(null);
  }, []);

  return {
    isTaskDialogOpen,
    setIsTaskDialogOpen,
    isTaskDetailsOpen,
    setIsTaskDetailsOpen,
    isSwimlaneDialogOpen,
    setIsSwimlaneDialogOpen,
    isPeoplePanelOpen,
    setIsPeoplePanelOpen,
    isPreferencesOpen,
    setIsPreferencesOpen,
    selectedTask,
    setSelectedTask,
    detailsTaskId,
    setDetailsTaskId,
    detailsTask,
    selectedSwimlane,
    setSelectedSwimlane,
    defaultStatus,
    defaultDate,
    defaultEndDate,
    defaultSwimlaneId,
    defaultAssigneeId,
    setDefaultStatus,
    setDefaultDate,
    setDefaultEndDate,
    setDefaultSwimlaneId,
    setDefaultAssigneeId,
    handleTaskClick,
    handleEditTaskFromKanban,
    handleEditTaskFromDetails,
    handleAddTaskFromTimeline,
    handleAddTaskFromSwimlane,
    handleCloseTaskDialog,
    handleEditSwimlane,
    handleAddSwimlane,
    handleCloseSwimlaneDialog,
  };
}
