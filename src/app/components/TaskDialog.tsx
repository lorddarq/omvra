import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { Briefcase, CalendarDays, GitBranch, User } from 'lucide-react';
import { Task, TaskStatus, TimelineSwimlane, Person, TaskSize, TaskComplexity, TaskPriority, StatusColumn, ProjectMilestone } from '../types';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import { toLocalISODate } from '../utils/date';
import { getMilestoneForTask, getMilestoneProjectIds } from '../utils/roadmap';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { normalizeTaskNotesForSave } from '../utils/taskNotes';

const MarkdownEditor = lazy(() =>
  import('./MarkdownEditor').then(module => ({ default: module.MarkdownEditor }))
);

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  onDelete?: (taskId: string) => void;
  task?: Task | null;
  defaultStatus?: TaskStatus;
  defaultDate?: Date;
  defaultEndDate?: Date;
  defaultSwimlaneId?: string;
  defaultAssigneeId?: string;
  swimlanes: TimelineSwimlane[];
  statusColumns?: StatusColumn[];
  people?: Person[];
  tasks?: Task[];
  milestones?: ProjectMilestone[];
  readModel?: WorkspaceReadModel;
}

export function TaskDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  task,
  defaultStatus,
  defaultDate,
  defaultEndDate,
  defaultSwimlaneId,
  defaultAssigneeId,
  swimlanes,
  statusColumns,
  people = [],
  tasks = [],
  milestones = [],
  readModel,
}: TaskDialogProps) {
  const NO_TIMELINE_VALUE = 'none';
  const NO_MILESTONE_VALUE = 'none';
  const todayISO = toLocalISODate(new Date());
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('open');
  const [notes, setNotes] = useState('');
  const [size, setSize] = useState<TaskSize>('m');
  const [complexity, setComplexity] = useState<TaskComplexity>('medium');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [blocked, setBlocked] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [swimlaneId, setSwimlaneId] = useState(NO_TIMELINE_VALUE);
  const [milestoneId, setMilestoneId] = useState(NO_MILESTONE_VALUE);
  const [dependencyIds, setDependencyIds] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState('unassigned');
  const hasInvalidDateRange = Boolean(startDate && endDate && endDate < startDate);
  const availableMilestones = readModel
    ? readModel.milestones
        .filter(milestone => milestone.projects.some(project => projectIds.includes(project.id)))
        .map(milestone => milestone.milestone)
    : milestones.filter(milestone =>
        getMilestoneProjectIds(milestone).some(projectId => projectIds.includes(projectId))
      );
  const selectedMilestone = useMemo(
    () => milestoneId === NO_MILESTONE_VALUE
      ? undefined
      : readModel?.milestonesById.get(milestoneId)?.milestone
        ?? milestones.find(milestone => milestone.id === milestoneId),
    [milestoneId, milestones, readModel]
  );
  const dependencyCandidates = useMemo(
    () => selectedMilestone
      ? (
          readModel?.milestonesById.get(selectedMilestone.id)?.summary.linkedTasks
          ?? tasks.filter(candidate =>
            candidate.milestoneId === selectedMilestone.id ||
            (selectedMilestone.linkedTaskIds || []).includes(candidate.id)
          )
        ).filter(candidate => candidate.id !== task?.id)
      : [],
    [readModel, selectedMilestone, task?.id, tasks]
  );
  const taskById = useMemo(
    () => readModel?.tasksById
      ? new Map(readModel.tasks.map(item => [item.task.id, item.task]))
      : new Map(tasks.map(item => [item.id, item])),
    [readModel, tasks]
  );

  const wouldCreateDependencyCycle = (dependencyId: string): boolean => {
    if (!task?.id) return false;
    const visited = new Set<string>();
    const visit = (taskId: string): boolean => {
      if (taskId === task.id) return true;
      if (visited.has(taskId)) return false;
      visited.add(taskId);
      const nextTask = taskById.get(taskId);
      return (nextTask?.dependencyIds || []).some(visit);
    };
    return visit(dependencyId);
  };

  useEffect(() => {
    if (task) {
      const initialProjectIds = task.projectIds?.length
        ? task.projectIds
        : (task.swimlaneId ? [task.swimlaneId] : []);
      const existingStart = task.startDate || todayISO;
      const existingEnd = task.endDate || existingStart;
      setTitle(task.title);
      setStatus(task.status);
      setNotes(task.notes || '');
      setSize(task.size || 'm');
      setComplexity(task.complexity || 'medium');
      setPriority(task.priority || 'normal');
      setBlocked(Boolean(task.blocked));
      setStartDate(existingStart);
      setEndDate(existingEnd);
      setProjectIds(initialProjectIds);
      setSwimlaneId(task.swimlaneId || (initialProjectIds[0] || NO_TIMELINE_VALUE));
      setMilestoneId(
        readModel?.tasksById.get(task.id)?.milestone?.id
          || getMilestoneForTask(task, milestones)?.id
          || NO_MILESTONE_VALUE
      );
      setDependencyIds(Array.isArray(task.dependencyIds) ? task.dependencyIds : []);
      setAssigneeId(task.assigneeId || 'unassigned');
    } else {
      const initialProjectIds = defaultSwimlaneId ? [defaultSwimlaneId] : [];
      setTitle('');
      setStatus(defaultStatus || 'open');
      setNotes('');
      setSize('m');
      setComplexity('medium');
      setPriority('normal');
      setBlocked(false);
      setProjectIds(initialProjectIds);
      setSwimlaneId(defaultSwimlaneId || NO_TIMELINE_VALUE);
      setMilestoneId(NO_MILESTONE_VALUE);
      setDependencyIds([]);
      setAssigneeId(defaultAssigneeId || 'unassigned');
      
      if (defaultDate) {
        const dateStr = toLocalISODate(defaultDate);
        setStartDate(dateStr);
        const endDateObj = defaultEndDate || new Date(defaultDate);
        setEndDate(toLocalISODate(endDateObj));
      } else {
        setStartDate(todayISO);
        setEndDate(todayISO);
      }
    }
  }, [task, defaultStatus, defaultDate, defaultEndDate, defaultSwimlaneId, defaultAssigneeId, isOpen, milestones, readModel, todayISO]);

  useEffect(() => {
    if (milestoneId === NO_MILESTONE_VALUE) return;
    if (!availableMilestones.some(milestone => milestone.id === milestoneId)) {
      setMilestoneId(NO_MILESTONE_VALUE);
    }
  }, [availableMilestones, milestoneId]);

  useEffect(() => {
    if (milestoneId === NO_MILESTONE_VALUE) {
      setDependencyIds([]);
      return;
    }

    const candidateIds = new Set(dependencyCandidates.map(candidate => candidate.id));
    setDependencyIds(previousIds => previousIds.filter(dependencyId => candidateIds.has(dependencyId)));
  }, [dependencyCandidates, milestoneId]);

  const toggleDependency = (dependencyId: string) => {
    if (wouldCreateDependencyCycle(dependencyId)) return;
    setDependencyIds(previousIds =>
      previousIds.includes(dependencyId)
        ? previousIds.filter(id => id !== dependencyId)
        : [...previousIds, dependencyId]
    );
  };

  const handleSave = () => {
    if (!title.trim() || hasInvalidDateRange) return;

    const taskData: Partial<Task> = {
      ...(task && { id: task.id }),
      title: title.trim(),
      status,
      notes: normalizeTaskNotesForSave(notes),
      size,
      complexity,
      priority,
      blocked,
      projectIds,
      swimlaneOnly: projectIds.length === 0 || swimlaneId === NO_TIMELINE_VALUE,
      swimlaneId: swimlaneId === NO_TIMELINE_VALUE ? undefined : swimlaneId,
      project: projectIds
        .map(id => swimlanes.find(s => s.id === id)?.name)
        .filter(Boolean)
        .join(', ') || undefined,
      assigneeId: assigneeId === 'unassigned' ? undefined : assigneeId,
      milestoneId: milestoneId === NO_MILESTONE_VALUE ? undefined : milestoneId,
      dependencyIds: milestoneId === NO_MILESTONE_VALUE ? [] : dependencyIds,
    };

    taskData.startDate = startDate || todayISO;
    taskData.endDate = endDate || taskData.startDate;

    onSave(taskData);
    onClose();
  };

  const handleDelete = () => {
    if (task && onDelete) {
      onDelete(task.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[760px] rounded-2xl border-0 p-0">
        <DialogHeader className="px-8 pt-8 pb-1">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            {task ? 'Edit Task' : 'Create Task'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {task ? 'Edit the task details below.' : 'Enter the task details below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-8 py-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder=""
                autoFocus
                className="h-11 rounded-xl border-0 bg-gray-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                <SelectTrigger id="status" className="h-11 rounded-xl border-0 bg-gray-100 px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusColumns && statusColumns.length > 0 ? (
                    statusColumns.map(col => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.title}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="under-review">Under Review</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-size">Task Size</Label>
              <Select value={size} onValueChange={(value) => setSize(value as TaskSize)}>
                <SelectTrigger id="task-size" className="h-11 rounded-xl border-0 bg-gray-100 px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xs">XS</SelectItem>
                  <SelectItem value="s">S</SelectItem>
                  <SelectItem value="m">M</SelectItem>
                  <SelectItem value="l">L</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-complexity">Complexity</Label>
              <Select value={complexity} onValueChange={(value) => setComplexity(value as TaskComplexity)}>
                <SelectTrigger id="task-complexity" className="h-11 rounded-xl border-0 bg-gray-100 px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger id="task-priority" className="h-11 rounded-xl border-0 bg-gray-100 px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex items-end">
              <label className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2">
                <input
                  type="checkbox"
                  checked={blocked}
                  onChange={(e) => setBlocked(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-800">Blocked task</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Assign to Projects</Label>
              <div className="space-y-2 rounded-xl bg-gray-100 p-3">
                {swimlanes.map(swimlane => {
                  const isChecked = projectIds.includes(swimlane.id);
                  return (
                    <label key={swimlane.id} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setProjectIds(prev => {
                            const next = checked
                              ? [...new Set([...prev, swimlane.id])]
                              : prev.filter(id => id !== swimlane.id);

                            setSwimlaneId(current => {
                              if (current !== NO_TIMELINE_VALUE && !next.includes(current)) {
                                return next[0] || NO_TIMELINE_VALUE;
                              }
                              return current;
                            });

                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-800">{swimlane.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="swimlane">Primary Timeline Project</Label>
              <Select value={swimlaneId} onValueChange={setSwimlaneId}>
                <SelectTrigger
                  id="swimlane"
                  className="relative h-11 rounded-xl border-0 bg-gray-100 pl-10 pr-10"
                  disabled={projectIds.length === 0}
                >
                  <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-700" />
                  <SelectValue placeholder={projectIds.length ? 'Select timeline project' : 'No project selected'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TIMELINE_VALUE}>No timeline project</SelectItem>
                  {projectIds.map(projectId => {
                    const project = swimlanes.find(swimlane => swimlane.id === projectId);
                    if (!project) return null;
                    return (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {people.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="assignee">Assign to Person (Optional)</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger id="assignee" className="relative h-11 rounded-xl border-0 bg-gray-100 pl-10 pr-10">
                    <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-700" />
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {people.map(person => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.kind === 'agentic' ? 'Agent' : 'Human'}: {person.name} - {person.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="roadmap-milestone">Roadmap Milestone</Label>
              <Select
                value={milestoneId}
                onValueChange={setMilestoneId}
                disabled={availableMilestones.length === 0}
              >
                <SelectTrigger id="roadmap-milestone" className="relative h-11 rounded-xl border-0 bg-gray-100 pl-10 pr-10">
                  <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-700" />
                  <SelectValue placeholder={availableMilestones.length ? 'Select milestone' : 'No matching milestones'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MILESTONE_VALUE}>No roadmap milestone</SelectItem>
                  {availableMilestones.map(milestone => (
                    <SelectItem key={milestone.id} value={milestone.id}>
                      {milestone.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableMilestones.length === 0 && projectIds.length > 0 && (
                <p className="text-xs text-gray-500">Create a Roadmap milestone for one of this task's projects to link it.</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Task Dependencies</Label>
              <div className="rounded-xl bg-gray-100 p-3">
                <div className="mb-3 flex items-start gap-2 text-sm text-gray-600">
                  <GitBranch className="mt-0.5 size-4 shrink-0 text-gray-700" />
                  <p>
                    Dependencies are shown on the Roadmap. A task can depend on other tasks linked to the same milestone.
                  </p>
                </div>

                {milestoneId === NO_MILESTONE_VALUE ? (
                  <p className="rounded-lg bg-white p-3 text-sm text-gray-600">
                    Select a Roadmap milestone to choose dependencies.
                  </p>
                ) : dependencyCandidates.length === 0 ? (
                  <p className="rounded-lg bg-white p-3 text-sm text-gray-600">
                    No other tasks are linked to this milestone yet.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {dependencyCandidates.map(candidate => {
                      const createsCycle = wouldCreateDependencyCycle(candidate.id);
                      return (
                        <label
                          key={candidate.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 text-sm ${
                            createsCycle ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={dependencyIds.includes(candidate.id)}
                            disabled={createsCycle}
                            onChange={() => toggleDependency(candidate.id)}
                            aria-label={`${title || 'Task'} depends on ${candidate.title}`}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-800">{candidate.title}</span>
                            <span className="mt-0.5 block text-xs text-gray-500">
                              {createsCycle ? 'Unavailable because it would create a dependency cycle' : candidate.status}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {swimlaneId !== NO_TIMELINE_VALUE && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-700" />
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const nextStart = e.target.value;
                      setStartDate(nextStart);
                      if (endDate && nextStart && endDate < nextStart) {
                        setEndDate(nextStart);
                      }
                    }}
                    className="h-11 rounded-xl border-0 bg-gray-100 pl-10 pr-4"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-700" />
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => {
                      const nextEnd = e.target.value;
                      if (startDate && nextEnd && nextEnd < startDate) {
                        setEndDate(startDate);
                        return;
                      }
                      setEndDate(nextEnd);
                    }}
                    className="h-11 rounded-xl border-0 bg-gray-100 pl-10 pr-4"
                  />
                </div>
                {hasInvalidDateRange && (
                  <p className="text-xs text-red-600">End date cannot be earlier than start date.</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="notes">Notes & Details</Label>
              <p className="hidden text-base text-gray-500 md:block">
                {task ? 'Edit the task details below.' : 'Enter the task details below.'}
              </p>
            </div>
            <Suspense
              fallback={
                <div
                  className="h-64 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
                  aria-label="Loading notes editor"
                />
              }
            >
              <MarkdownEditor
                id="notes"
                value={notes}
                onChange={setNotes}
              />
            </Suspense>
          </div>
        </div>

        <DialogFooter className="px-8 pb-8 pt-1">
          {task && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="mr-auto h-10 rounded-xl px-5"
            >
              Delete
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!title.trim() || hasInvalidDateRange}
            className="h-10 rounded-xl bg-[#020329] px-5 hover:bg-[#020329]/90"
          >
            {task ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
