import { useEffect, useState, useRef } from 'react';
import { Task, TaskStatus, TimelineSwimlane, Person } from './types';
import { initialTasks, initialTimelineSwimlanes } from './data/sampleData';
import { initialPeople } from './data/samplePeople';
import { TimelineView } from './components/TimelineView';
import { KanbanView } from './components/KanbanView';
import { ViewToggle } from './components/ViewToggle';
import { useViewState } from './hooks/useViewState';
import { useSharedHorizontalScroll } from './hooks/useSharedHorizontalScroll';
import { useVirtualizedTimeline } from './hooks/useVirtualizedTimeline';

// LocalStorage keys
const TASKS_KEY = 'plumy.tasks.v1';
const SWIMLANES_KEY = 'plumy.swimlanes.v1';
const PEOPLE_KEY = 'plumy.people.v1';

function safeReadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch (err) {
    return fallback;
  }
}

function safeWriteJSON<T>(key: string, value: T) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // ignore
  }
}
import { SwimlanesView } from './components/SwimlanesView';
import { TaskDialog } from './components/TaskDialog';
import { SwimlaneDialog } from './components/SwimlaneDialog';
import { PeoplePanel } from './components/PeoplePanel';
import { TaskDetailsDialog } from './components/TaskDetailsDialog';
import logo from './images/logo.svg';
import { Button } from './components/ui/button';
import { Menu, Plus, Bell, CheckCircle, User } from 'lucide-react';
import { swimlanes as defaultSwimlanes } from './constants/swimlanes';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

function App() {
  // Initialize hooks for view management
  const viewState = useViewState('timeline');
  const scroll = useSharedHorizontalScroll();
  const timeline = useVirtualizedTimeline();

  // Refs for view containers (to capture scroll position)
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const kanbanContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollStateRef = useRef<{ scrollLeft: number; scrollTop: number }>({
    scrollLeft: 0,
    scrollTop: 0,
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const stored = safeReadJSON<Task[]>(TASKS_KEY, initialTasks);
    const swimlanes = safeReadJSON<TimelineSwimlane[]>(SWIMLANES_KEY, initialTimelineSwimlanes);
    
    // Migrate: Ensure project names and multi-project ids are present.
    return stored.map(task => {
      const projectIds = task.projectIds?.length
        ? task.projectIds
        : (task.swimlaneId ? [task.swimlaneId] : []);
      const projectName = projectIds
        .map(projectId => swimlanes.find(s => s.id === projectId)?.name)
        .filter(Boolean)
        .join(', ');

      return {
        ...task,
        projectIds,
        project: projectName || task.project,
        size: task.size || 'm',
        complexity: task.complexity || 'medium',
        blocked: Boolean(task.blocked),
        priority: task.priority || 'normal',
      };
    });
  });
  
  const [timelineSwimlanes, setTimelineSwimlanes] = useState<TimelineSwimlane[]>(() => {
    const stored = safeReadJSON<TimelineSwimlane[]>(SWIMLANES_KEY, initialTimelineSwimlanes);
    
    // Migrate: Ensure all swimlanes have colors
    return stored.map(swimlane => ({
      ...swimlane,
      color: swimlane.color || '#3b82f6' // Default blue if no color
    }));
  });
  
  const [people, setPeople] = useState<Person[]>(() => {
    const stored = safeReadJSON<Person[]>(PEOPLE_KEY, initialPeople);
    
    // Migrate: Ensure all people have colors
    const defaultColors = ['#ec4899', '#f97316', '#eab308', '#06b6d4', '#8b5cf6', '#10b981'];
    return stored.map((person, index) => ({
      ...person,
      color: person.color || defaultColors[index % defaultColors.length]
    }));
  });

  // Status columns (swimlane columns for the kanban view) — persisted separately
  const STATUS_COLUMNS_KEY = 'plumy.statusColumns.v1';
  const [statusColumns, setStatusColumns] = useState(() => safeReadJSON(STATUS_COLUMNS_KEY, defaultSwimlanes));

  useEffect(() => { safeWriteJSON(STATUS_COLUMNS_KEY, statusColumns); }, [statusColumns]);

  // Persist tasks and swimlanes to localStorage whenever they change
  useEffect(() => {
    safeWriteJSON(TASKS_KEY, tasks);
  }, [tasks]);

  useEffect(() => {
    safeWriteJSON(SWIMLANES_KEY, timelineSwimlanes);
  }, [timelineSwimlanes]);

  useEffect(() => {
    safeWriteJSON(PEOPLE_KEY, people);
  }, [people]);

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [isSwimlaneDialogOpen, setIsSwimlaneDialogOpen] = useState(false);
  const [isPeoplePanelOpen, setIsPeoplePanelOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [selectedSwimlane, setSelectedSwimlane] = useState<TimelineSwimlane | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('open');
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [defaultEndDate, setDefaultEndDate] = useState<Date | undefined>(undefined);
  const [defaultSwimlaneId, setDefaultSwimlaneId] = useState<string | undefined>(undefined);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | undefined>(undefined);

  const detailsTask = detailsTaskId ? tasks.find(t => t.id === detailsTaskId) ?? null : null;

  const handleTaskClick = (task: Task) => {
    setDetailsTaskId(task.id);
    setIsTaskDetailsOpen(true);
  };

  const handleEditTaskFromKanban = (task: Task) => {
    setSelectedTask(task);
    setDefaultStatus(task.status);
    setDefaultDate(undefined);
    setDefaultSwimlaneId(task.swimlaneId);
    setIsTaskDialogOpen(true);
  };

  const handleEditTaskFromDetails = (task: Task) => {
    setIsTaskDetailsOpen(false);
    handleEditTaskFromKanban(task);
  };

  const handleAddTaskFromTimeline = (date: Date, swimlaneId: string, endDate?: Date, mode?: 'projects' | 'people') => {
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
  };

  const handleAddTaskFromSwimlane = (status: TaskStatus) => {
    setSelectedTask(null);
    setDefaultStatus(status);
    setDefaultDate(undefined);
    setDefaultSwimlaneId(undefined);
    setIsTaskDialogOpen(true);
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
    if (taskData.id) {
      // Update existing task
      setTasks(prevTasks => prevTasks.map(t => (t.id === taskData.id ? { ...t, ...taskData } : t)));
    } else {
      // Create new task
      const newTask: Task = {
        id: Date.now().toString(),
        title: taskData.title!,
        status: taskData.status || 'open',
        notes: taskData.notes,
        size: taskData.size || 'm',
        complexity: taskData.complexity || 'medium',
        blocked: Boolean(taskData.blocked),
        priority: taskData.priority || 'normal',
        startDate: taskData.startDate,
        endDate: taskData.endDate,
        swimlaneOnly: taskData.swimlaneOnly,
        swimlaneId: taskData.swimlaneId,
        assigneeId: taskData.assigneeId,
      };
      setTasks(prevTasks => [...prevTasks, newTask]);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
  };

  const handleMoveTask = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));
  };

  const handleUpdateTaskDates = (taskId: string, startDate: string, endDate: string) => {
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? { ...t, startDate, endDate } : t)));
  };

  const handleCloseTaskDialog = () => {
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
    setDefaultDate(undefined);
    setDefaultSwimlaneId(undefined);
    setDefaultAssigneeId(undefined);
  };

  const handleEditSwimlane = (swimlane: TimelineSwimlane) => {
    setSelectedSwimlane(swimlane);
    setIsSwimlaneDialogOpen(true);
  };

  const handleAddSwimlane = () => {
    setSelectedSwimlane(null);
    setIsSwimlaneDialogOpen(true);
  };

  const handleSaveSwimlane = (swimlaneData: Partial<TimelineSwimlane>) => {
    if (swimlaneData.id) {
      // Update existing swimlane
      setTimelineSwimlanes(
        timelineSwimlanes.map(s => (s.id === swimlaneData.id ? { ...s, ...swimlaneData } : s))
      );
    } else {
      // Create new swimlane
      const newSwimlane: TimelineSwimlane = {
        id: Date.now().toString(),
        name: swimlaneData.name!,
      };
      setTimelineSwimlanes([...timelineSwimlanes, newSwimlane]);
    }
  };

  const handleDeleteSwimlane = (swimlaneId: string) => {
    // Remove swimlane
    const remainingSwimlanes = timelineSwimlanes.filter(s => s.id !== swimlaneId);
    setTimelineSwimlanes(remainingSwimlanes);

    // Update tasks to remove swimlane references and deleted project membership
    setTasks(prevTasks => prevTasks.map(task => {
      const nextProjectIds = (task.projectIds || []).filter(id => id !== swimlaneId);
      const nextProject = nextProjectIds
        .map(projectId => remainingSwimlanes.find(s => s.id === projectId)?.name)
        .filter(Boolean)
        .join(', ') || undefined;

      return {
        ...task,
        swimlaneId: task.swimlaneId === swimlaneId ? undefined : task.swimlaneId,
        projectIds: nextProjectIds,
        project: nextProject,
        swimlaneOnly: nextProjectIds.length === 0 || !task.swimlaneId || task.swimlaneId === swimlaneId,
      };
    }));
  };

  const handleCloseSwimlaneDialog = () => {
    setIsSwimlaneDialogOpen(false);
    setSelectedSwimlane(null);
  };

  const handleAddPerson = (personData: Omit<Person, 'id'>) => {
    const newPerson: Person = {
      id: Date.now().toString(),
      name: personData.name,
      role: personData.role,
      avatar: personData.avatar,
    };
    setPeople(prevPeople => [...prevPeople, newPerson]);
  };

  const handleDeletePerson = (personId: string) => {
    setPeople(prevPeople => prevPeople.filter(p => p.id !== personId));
    setTasks(prevTasks => prevTasks.map(t => (t.assigneeId === personId ? { ...t, assigneeId: undefined } : t)));
  };

  const handleUpdatePerson = (personId: string, updates: Pick<Person, 'name' | 'role'>) => {
    setPeople(prevPeople => prevPeople.map(p => (p.id === personId ? { ...p, ...updates } : p)));
  };

  const handleReorderSwimlanes = (reorderedSwimlanes: TimelineSwimlane[]) => {
    setTimelineSwimlanes(reorderedSwimlanes);
  };

  const handleReorderPeople = (reorderedPeople: Person[]) => {
    setPeople(reorderedPeople);
  };

  const handleReorderTasks = (reorderedTasks: Task[]) => {
    setTasks(reorderedTasks);
  };

  // Status columns management (kanban/swimlane columns)
  const handleRenameStatusColumn = (colId: string, newTitle: string) => {
    setStatusColumns((cols: any[]) => cols.map(c => c.id === colId ? { ...c, title: newTitle } : c));
  };

  const handleChangeStatusColumnColor = (colId: string, newColorClass: string) => {
    setStatusColumns((cols: any[]) => cols.map(c => c.id === colId ? { ...c, color: newColorClass } : c));
  };

  const handleReorderStatusColumns = (fromIndex: number, toIndex: number) => {
    setStatusColumns((cols: any[]) => {
      const copy = [...cols];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleAddStatusColumn = (col: { id?: string; title: string; color?: string }) => {
    const newCol = { id: col.id || Date.now().toString(), title: col.title, color: col.color || '#9ca3af' };
    setStatusColumns((cols: any[]) => [...cols, newCol]);
  };

  const handleDeleteStatusColumn = (colId: string) => {
    // Check if any tasks use this status
    const tasksUsingStatus = tasks.filter(t => t.status === colId);
    if (tasksUsingStatus.length > 0) {
      // Move tasks to first remaining column, or mark as 'open'
      const remainingCols = statusColumns.filter(c => c.id !== colId);
      const fallbackStatus = remainingCols.length > 0 ? remainingCols[0].id : 'open';
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.status === colId ? { ...t, status: fallbackStatus as TaskStatus } : t
        )
      );
    }
    setStatusColumns((cols: any[]) => cols.filter(c => c.id !== colId));
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Plumy" className="h-10 w-auto antialiased" />
            <p className="text-lg font-semibold">plumy</p>
          </div>
          {/* View Toggle */}
          <ViewToggle
            currentView={viewState.currentView}
            onViewChange={(view) => {
              // Save current view state before switching
              if (viewState.currentView === 'timeline') {
                viewState.saveViewState('timeline', {
                  scrollLeft: timelineScrollStateRef.current.scrollLeft,
                  scrollTop: timelineScrollStateRef.current.scrollTop,
                  collapsedSwimlanes: [],
                  mode: 'projects',
                });
              } else if (viewState.currentView === 'kanban') {
                viewState.saveViewState('kanban', {
                  scrollLeft: kanbanContainerRef.current?.scrollLeft || 0,
                  scrollTop: kanbanContainerRef.current?.scrollTop || 0,
                });
              }
              // Switch to new view
              viewState.switchView(view);

              // Restore scroll position for the new view
              setTimeout(() => {
                const savedState = viewState.getViewState(view);
                if (view === 'kanban' && kanbanContainerRef.current) {
                  kanbanContainerRef.current.scrollLeft = savedState.scrollLeft || 0;
                  kanbanContainerRef.current.scrollTop = savedState.scrollTop || 0;
                }
              }, 0);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <CheckCircle className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsPeoplePanelOpen(true)}>
            <User className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Timeline View */}
        {viewState.currentView === 'timeline' && (
          <div ref={timelineContainerRef} className="h-full w-full">
            <TimelineView
              tasks={tasks}
              swimlanes={timelineSwimlanes}
              people={people}
              statusColumns={statusColumns}
              initialScrollLeft={viewState.getViewState('timeline').scrollLeft || 0}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTaskFromTimeline}
              onUpdateTaskDates={handleUpdateTaskDates}
              onEditSwimlane={handleEditSwimlane}
              onAddSwimlane={handleAddSwimlane}
              onReorderSwimlanes={handleReorderSwimlanes}
              onReorderPeople={handleReorderPeople}
              onReorderTasks={handleReorderTasks}
              onTimelineScroll={(state) => {
                timelineScrollStateRef.current = state;
              }}
            />
          </div>
        )}

        {/* Kanban View */}
        {viewState.currentView === 'kanban' && (
          <div ref={kanbanContainerRef} className="h-full w-full">
            <DndProvider backend={HTML5Backend}>
              <KanbanView
                tasks={tasks}
                swimlanes={statusColumns}
                onTaskClick={handleTaskClick}
                onEditTask={handleEditTaskFromKanban}
                onAddTask={handleAddTaskFromSwimlane}
                onMoveTask={handleMoveTask}
                onReorderTasks={handleReorderTasks}
                onReorderColumns={handleReorderStatusColumns}
                onRenameColumn={handleRenameStatusColumn}
                onChangeColumnColor={handleChangeStatusColumnColor}
                onAddColumn={handleAddStatusColumn}
                onDeleteColumn={handleDeleteStatusColumn}
              />
            </DndProvider>
          </div>
        )}
      </div>

      {/* Task Dialog */}
      <TaskDialog
        isOpen={isTaskDialogOpen}
        onClose={handleCloseTaskDialog}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        task={selectedTask}
        defaultStatus={defaultStatus}
        defaultDate={defaultDate}
        defaultEndDate={defaultEndDate}
        defaultSwimlaneId={defaultSwimlaneId}
        defaultAssigneeId={defaultAssigneeId}
        swimlanes={timelineSwimlanes}
        statusColumns={statusColumns}
        people={people}
      />

      {/* Task Details Dialog */}
      <TaskDetailsDialog
        isOpen={isTaskDetailsOpen}
        onClose={() => setIsTaskDetailsOpen(false)}
        onEdit={handleEditTaskFromDetails}
        task={detailsTask}
        swimlanes={timelineSwimlanes}
        people={people}
        statusColumns={statusColumns}
      />

      {/* Swimlane Dialog */}
      <SwimlaneDialog
        isOpen={isSwimlaneDialogOpen}
        onClose={handleCloseSwimlaneDialog}
        onSave={handleSaveSwimlane}
        onDelete={handleDeleteSwimlane}
        swimlane={selectedSwimlane}
      />

      {/* People Panel */}
      <PeoplePanel
        isOpen={isPeoplePanelOpen}
        onClose={() => setIsPeoplePanelOpen(false)}
        people={people}
        tasks={tasks}
        statusColumns={statusColumns}
        onAddPerson={handleAddPerson}
        onUpdatePerson={handleUpdatePerson}
        onDeletePerson={handleDeletePerson}
      />
    </div>
  );
}

export default App;
