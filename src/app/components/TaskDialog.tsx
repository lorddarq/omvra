import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Briefcase, CalendarDays, ChevronsUpDown, FileText, Info, Link2, Paperclip, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react';
import { Task, TaskStatus, TimelineSwimlane, Person, TaskSize, TaskComplexity, TaskPriority, StatusColumn, ProjectMilestone, TaskAttachment } from '../types';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import { toLocalISODate } from '../utils/date';
import { getMilestoneForTask, getMilestoneProjectIds } from '../utils/roadmap';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
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
import { TaskDependenciesSection } from './TaskDependenciesSection';
import { AnchoredPanel, AnchoredPanelSection } from './AnchoredPanel';
import { EmptyStateCard } from './EmptyStateCard';
import {
  taskEditFieldClassName,
  taskEditIconFieldClassName,
  taskEditIconSelectClassName,
  taskEditLabelClassName,
  taskEditSelectClassName,
  taskEditTextAreaClassName,
} from './taskFormStyles';
import { TASK_PRIORITY_ICONS } from './taskPriorityIcons';
import { TaskCheckboxControl } from './TaskCheckboxControl';

function getFileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || filePath;
}

function toFileUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const prefixed = normalized.match(/^[A-Za-z]:\//) ? `/${normalized}` : normalized;
  return `file://${encodeURI(prefixed)}`;
}

function formatAttachmentSize(size?: number): string {
  if (!Number.isFinite(size) || !size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTaskDateDisplay(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

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
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentAvailabilityByPath, setAttachmentAvailabilityByPath] = useState<Record<string, boolean | undefined>>({});
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const hasInvalidDateRange = Boolean(startDate && endDate && endDate < startDate);
  const normalizedProjectSearchQuery = projectSearchQuery.trim().toLowerCase();
  const filteredSwimlanes = useMemo(
    () => normalizedProjectSearchQuery
      ? swimlanes.filter(swimlane => swimlane.name.toLowerCase().includes(normalizedProjectSearchQuery))
      : swimlanes,
    [normalizedProjectSearchQuery, swimlanes]
  );
  const selectedProjects = useMemo(
    () => projectIds
      .map(projectId => swimlanes.find(swimlane => swimlane.id === projectId))
      .filter((swimlane): swimlane is TimelineSwimlane => Boolean(swimlane)),
    [projectIds, swimlanes]
  );
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
      setAttachments(Array.isArray(task.attachments) ? task.attachments : []);
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
      setAttachments([]);
      
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
    let isMounted = true;
    const verify = window.electron?.attachments?.verify;

    if (!verify || attachments.length === 0) {
      setAttachmentAvailabilityByPath({});
      return;
    }

    Promise.all(
      attachments.map(async attachment => {
        const result = await verify(attachment.path).catch(() => null);
        return [attachment.path, Boolean(result?.exists)] as const;
      })
    ).then(results => {
      if (!isMounted) return;
      setAttachmentAvailabilityByPath(Object.fromEntries(results));
    });

    return () => {
      isMounted = false;
    };
  }, [attachments]);

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

  const handleAddAttachments = async () => {
    const pickedPaths = await window.electron?.attachments?.pick?.();
    if (!Array.isArray(pickedPaths) || pickedPaths.length === 0) return;

    const existingPaths = new Set(attachments.map(attachment => attachment.path));
    const nextAttachments = await Promise.all(
      pickedPaths
        .filter(filePath => typeof filePath === 'string' && filePath.trim() && !existingPaths.has(filePath))
        .map(async (filePath): Promise<TaskAttachment> => {
          const verified = await window.electron?.attachments?.verify?.(filePath).catch(() => null);
          return {
            id: `attachment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            name: getFileNameFromPath(filePath),
            path: filePath,
            uri: toFileUri(filePath),
            size: verified?.exists && Number.isFinite(Number(verified.size)) ? Number(verified.size) : undefined,
            addedAt: new Date().toISOString(),
          };
        })
    );

    if (nextAttachments.length > 0) {
      setAttachments(previousAttachments => [...previousAttachments, ...nextAttachments]);
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(previousAttachments => previousAttachments.filter(attachment => attachment.id !== attachmentId));
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
      attachments,
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

  const editNavGroups = useMemo(
    () => [
      {
        label: 'Task Details',
        items: [
          { id: 'task-edit-basic', label: 'Basic Info', icon: Info },
          { id: 'task-edit-roadmap', label: 'Dependencies', icon: Link2 },
          { id: 'task-edit-description', label: 'Description', icon: FileText },
          { id: 'task-edit-attachments', label: 'Attachments', icon: Paperclip },
        ],
      },
    ],
    []
  );
  const selectedProjectChips = selectedProjects.slice(0, 2);
  const remainingSelectedProjectCount = selectedProjects.length - selectedProjectChips.length;
  const selectedPriorityIcon = TASK_PRIORITY_ICONS[priority];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showClose={false}
        overlayClassName="omvra-settings-overlay"
        className="h-[min(920px,calc(100vh-2rem))] w-[min(837px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-[24px] border-0 bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.10),0_-6px_12px_rgba(0,0,0,0.10),0_14px_28px_rgba(0,0,0,0.10)] sm:max-w-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{task ? 'Edit Task' : 'Create Task'}</DialogTitle>
          <DialogDescription className="sr-only">
            {task ? 'Edit the task details below.' : 'Enter the task details below.'}
          </DialogDescription>
        </DialogHeader>

        <AnchoredPanel
          title={task ? 'Edit Task' : 'Create Task'}
          description={task ? 'Edit the task details below.' : 'Enter the task details below.'}
          navGroups={editNavGroups}
          footer={(
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {task && onDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDelete}
                    className="h-8 gap-1 rounded-xl border-[#b50000]/10 bg-[#c40000]/10 px-3 text-sm font-medium text-[#cd0000] hover:bg-[#c40000]/15 hover:text-[#cd0000]"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-8 rounded-xl border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] hover:bg-[#71717a]/5 hover:text-[#67676f]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!title.trim() || hasInvalidDateRange}
                  className="h-8 gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] shadow-none hover:bg-[#71717a]/5 hover:text-[#67676f] disabled:opacity-50"
                >
                  <RefreshCw className="size-4" />
                  {task ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          )}
        >
          <AnchoredPanelSection
            id="task-edit-basic"
            title="Basic Information"
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-x-2 gap-y-5 md:grid-cols-[minmax(0,1fr)_144px]">
                <div className="space-y-1">
                  <Label htmlFor="title" className={taskEditLabelClassName}>Task name</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder=""
                    autoFocus
                    className={taskEditFieldClassName}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="status" className={taskEditLabelClassName}>Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                    <SelectTrigger id="status" className={taskEditSelectClassName}>
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
              </div>

              <div className="grid grid-cols-1 gap-x-2 gap-y-5 md:grid-cols-2">
                <TaskDateSelectField
                  id="startDate"
                  label="Start Date:"
                  value={startDate}
                  onChange={(nextStart) => {
                    setStartDate(nextStart);
                    if (endDate && nextStart && endDate < nextStart) {
                      setEndDate(nextStart);
                    }
                  }}
                />

                <div>
                  <TaskDateSelectField
                    id="endDate"
                    label="End Date:"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(nextEnd) => {
                      if (startDate && nextEnd && nextEnd < startDate) {
                        setEndDate(startDate);
                        return;
                      }
                      setEndDate(nextEnd);
                    }}
                  />
                  {hasInvalidDateRange && (
                    <p className="mt-1 text-xs text-red-600">End date cannot be earlier than start date.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-5 md:grid-cols-[minmax(0,136px)_minmax(0,136px)_72px_120px_72px]">
                {people.length > 0 && (
                  <div className="space-y-1">
                    <Label htmlFor="assignee" className={taskEditLabelClassName}>Assignee</Label>
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                      <SelectTrigger id="assignee" className={taskEditIconSelectClassName}>
                        <Sparkles className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
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

                <div className="space-y-1">
                  <Label htmlFor="task-priority" className={taskEditLabelClassName}>Priority</Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                    <SelectTrigger id="task-priority" className={taskEditIconSelectClassName}>
                      <img
                        src={selectedPriorityIcon.src}
                        alt=""
                        aria-hidden="true"
                        className="absolute left-2 top-1/2 size-4 -translate-y-1/2"
                      />
                      <span className="min-w-0 flex-1 truncate">{selectedPriorityIcon.display}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TASK_PRIORITY_ICONS) as TaskPriority[]).map(priorityValue => (
                        <SelectItem key={priorityValue} value={priorityValue}>
                          <span className="flex items-center gap-2">
                            <img
                              src={TASK_PRIORITY_ICONS[priorityValue].src}
                              alt=""
                              aria-hidden="true"
                              className="size-4"
                            />
                            {TASK_PRIORITY_ICONS[priorityValue].display}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="task-size" className={taskEditLabelClassName}>Size</Label>
                  <Select value={size} onValueChange={(value) => setSize(value as TaskSize)}>
                    <SelectTrigger id="task-size" className={taskEditSelectClassName}>
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

                <div className="space-y-1">
                  <Label htmlFor="task-complexity" className={taskEditLabelClassName}>Complexity</Label>
                  <Select value={complexity} onValueChange={(value) => setComplexity(value as TaskComplexity)}>
                    <SelectTrigger id="task-complexity" className={taskEditSelectClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="task-blocked" className={taskEditLabelClassName}>Blocked</Label>
                  <Select value={blocked ? 'yes' : 'no'} onValueChange={(value) => setBlocked(value === 'yes')}>
                    <SelectTrigger id="task-blocked" className={taskEditSelectClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-2 gap-y-5 md:grid-cols-[minmax(0,1fr)_200px]">
                <div className="space-y-1">
                  <Label htmlFor="project-search" className={taskEditLabelClassName}>Search Project:</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
                    <Input
                      id="project-search"
                      value={projectSearchQuery}
                      onChange={(event) => setProjectSearchQuery(event.target.value)}
                      placeholder="Search projects..."
                      className={taskEditIconFieldClassName}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="swimlane" className={taskEditLabelClassName}>Timeline Project</Label>
                  <Select value={swimlaneId} onValueChange={setSwimlaneId}>
                    <SelectTrigger
                      id="swimlane"
                      className={taskEditIconSelectClassName}
                      disabled={projectIds.length === 0}
                    >
                      <Briefcase className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
                      <SelectValue placeholder={projectIds.length ? 'Select project' : 'No project selected'} />
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
              </div>

              <div className="max-h-36 overflow-y-auto rounded-[18px] border border-black/[0.06] bg-white p-3 shadow-[0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)]">
                {filteredSwimlanes.length > 0 ? (
                  filteredSwimlanes.map(swimlane => {
                    const isChecked = projectIds.includes(swimlane.id);
                    return (
                      <label
                        key={swimlane.id}
                        className="flex h-10 cursor-pointer items-center gap-2 border-b border-black/[0.06] px-2 last:border-b-0 hover:bg-[#71717a]/5"
                      >
                        <TaskCheckboxControl
                          checked={isChecked}
                          onCheckedChange={(checked) => {
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
                        />
                        <Briefcase className="size-4 shrink-0 text-[#f59e0b]" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#3f3f46]">{swimlane.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <EmptyStateCard
                    compact
                    icon={<Briefcase className="size-4" />}
                    title={`No projects match "${projectSearchQuery}"`}
                    description="Try a different project name or clear the search to see all available timeline projects."
                  />
                )}
              </div>

              <div className="flex min-h-6 flex-wrap items-center gap-1.5 text-xs font-medium text-[#71717a]">
                <span>Projects:</span>
                {selectedProjectChips.length > 0 ? (
                  <>
                    {selectedProjectChips.map(project => (
                      <Badge
                        key={project.id}
                        variant="outline"
                        className="max-w-[180px] rounded-full border-black/10 bg-[#71717a]/10 px-2 py-0.5 text-[11px] font-semibold text-[#71717a]"
                        title={project.name}
                      >
                        <span className="truncate">{project.name}</span>
                      </Badge>
                    ))}
                    {remainingSelectedProjectCount > 0 && (
                      <Badge
                        variant="outline"
                        className="rounded-full border-black/10 bg-[#71717a]/10 px-2 py-0.5 text-[11px] font-semibold text-[#71717a]"
                      >
                        {remainingSelectedProjectCount} More
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-[#a1a1aa]">None</span>
                )}
              </div>
            </div>
          </AnchoredPanelSection>

          <AnchoredPanelSection
            id="task-edit-roadmap"
            title="Dependencies"
          >
            <TaskDependenciesSection
              milestoneSelected={milestoneId !== NO_MILESTONE_VALUE}
              milestoneControl={(
                <div className="space-y-1">
                  <Label htmlFor="roadmap-milestone" className={taskEditLabelClassName}>Milestone</Label>
                  <Select
                    value={milestoneId}
                    onValueChange={setMilestoneId}
                    disabled={availableMilestones.length === 0}
                  >
                    <SelectTrigger id="roadmap-milestone" className={taskEditSelectClassName}>
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
                </div>
              )}
              dependencyCandidates={dependencyCandidates}
              dependencyIds={dependencyIds}
              taskTitle={title}
              wouldCreateDependencyCycle={wouldCreateDependencyCycle}
              onToggleDependency={toggleDependency}
            />
          </AnchoredPanelSection>

          <AnchoredPanelSection
            id="task-edit-description"
            title="Description"
          >
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="notes" className={taskEditLabelClassName}>Notes & Details</Label>
                <p className="hidden text-xs text-[#8a8a92] md:block">
                  {task ? 'Edit the task details below.' : 'Enter the task details below.'}
                </p>
              </div>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Write notes in markdown..."
                className={taskEditTextAreaClassName}
              />
            </div>
          </AnchoredPanelSection>

          <AnchoredPanelSection
            id="task-edit-attachments"
            title="Attachments"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className={taskEditLabelClassName}>Attachments</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddAttachments}
                  disabled={!window.electron?.attachments?.pick}
                  className="h-8 gap-2 rounded-full px-3 text-xs"
                >
                  <Paperclip className="size-4" />
                  Add files
                </Button>
              </div>

              {attachments.length > 0 ? (
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-[#71717a]/10 bg-white p-2">
                  {attachments.map(attachment => {
                    const sizeLabel = formatAttachmentSize(attachment.size);
                    const isMissing = attachmentAvailabilityByPath[attachment.path] === false;
                    return (
                      <div
                        key={attachment.id}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-3 ${
                          isMissing ? 'border-red-100 bg-red-50' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="truncate text-xs font-medium text-[#6a7282]">{attachment.name}</div>
                            {isMissing && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                <AlertTriangle className="size-3" />
                                Missing
                              </span>
                            )}
                          </div>
                          <div className={`truncate text-[11px] ${isMissing ? 'text-red-600' : 'text-[#8a8a92]'}`}>
                            {attachment.path}
                            {!isMissing && sizeLabel ? ` - ${sizeLabel}` : ''}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          className="h-7 shrink-0 gap-2 rounded-full px-2"
                          aria-label={`Remove ${attachment.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyStateCard
                  compact
                  icon={<Paperclip className="size-4" />}
                  title="No files attached"
                  description="Add files here to keep source material, exports, and supporting artifacts attached while editing."
                />
              )}
            </div>
          </AnchoredPanelSection>
        </AnchoredPanel>
      </DialogContent>
    </Dialog>
  );
}

interface TaskDateSelectFieldProps {
  id: string;
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}

function TaskDateSelectField({ id, label, value, min, onChange }: TaskDateSelectFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openDatePicker = () => {
    const input = inputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className={taskEditLabelClassName}>{label}</Label>
      <div
        role="button"
        tabIndex={0}
        aria-label={label.replace(':', '')}
        className={`${taskEditIconSelectClassName} cursor-pointer`}
        onClick={openDatePicker}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          openDatePicker();
        }}
      >
        <CalendarDays className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
        <span className="min-w-0 flex-1 truncate text-[#67676f]">
          {formatTaskDateDisplay(value)}
        </span>
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 opacity-0"
          aria-label={label.replace(':', '')}
        />
      </div>
    </div>
  );
}
