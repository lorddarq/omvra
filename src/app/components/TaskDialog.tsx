import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Briefcase, CalendarDays, FileText, FolderKanban, Info, Link2, Paperclip, Search, Trash2, User } from 'lucide-react';
import { Task, TaskStatus, TimelineSwimlane, Person, TaskSize, TaskComplexity, TaskPriority, StatusColumn, ProjectMilestone, TaskAttachment } from '../types';
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
          { id: 'task-edit-projects', label: 'Projects', icon: FolderKanban },
          { id: 'task-edit-roadmap', label: 'Dependencies', icon: Link2 },
          { id: 'task-edit-schedule', label: 'Schedule', icon: CalendarDays, disabled: swimlaneId === NO_TIMELINE_VALUE },
          { id: 'task-edit-description', label: 'Description', icon: FileText },
          { id: 'task-edit-attachments', label: 'Attachments', icon: Paperclip },
        ],
      },
    ],
    [swimlaneId]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showClose={false}
        overlayClassName="plumy-settings-overlay"
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
            <DialogFooter className="min-w-0">
              {task && onDelete && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="mr-auto h-8 rounded-full px-4 text-sm"
                >
                  Delete
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={!title.trim() || hasInvalidDateRange}
                className="h-8 rounded-full bg-[#020329] px-4 text-sm hover:bg-[#020329]/90"
              >
                {task ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          )}
        >
          <AnchoredPanelSection
            id="task-edit-basic"
            title="Basic Information"
          >
            <div className="grid grid-cols-1 gap-x-2 gap-y-5 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Task Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder=""
                  autoFocus
                  className="h-8 rounded-lg border-0 bg-[#71717a]/5 px-2 text-sm text-[#1f2937]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                  <SelectTrigger id="status" className="h-8 rounded-lg border-0 bg-[#71717a]/5 px-2 text-sm text-[#1f2937]">
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
                  <SelectTrigger id="task-size" className="h-8 rounded-lg border-0 bg-[#71717a]/5 px-2 text-sm text-[#1f2937]">
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

              <div className="space-y-2">
                <Label htmlFor="task-complexity">Complexity</Label>
                <Select value={complexity} onValueChange={(value) => setComplexity(value as TaskComplexity)}>
                  <SelectTrigger id="task-complexity" className="h-8 rounded-lg border-0 bg-[#71717a]/5 px-2 text-sm text-[#1f2937]">
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
                  <SelectTrigger id="task-priority" className="h-8 rounded-lg border-0 bg-[#71717a]/5 px-2 text-sm text-[#1f2937]">
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

              <div className="flex items-end">
                <label className="flex h-8 items-center gap-2 rounded-lg bg-[#71717a]/5 px-3">
                  <input
                    type="checkbox"
                    checked={blocked}
                    onChange={(e) => setBlocked(e.target.checked)}
                    className="h-4 w-4 rounded border-[#71717a]/20"
                  />
                  <span className="text-sm text-[#1f2937]">Blocked task</span>
                </label>
              </div>
            </div>
          </AnchoredPanelSection>

          <AnchoredPanelSection
            id="task-edit-projects"
            title="Projects"
          >
            <div className="grid grid-cols-1 gap-x-2 gap-y-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Assign to Projects</Label>
                <div className="space-y-3 rounded-xl bg-[#71717a]/5 p-3">
                  {selectedProjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProjects.map(project => (
                        <Badge
                          key={project.id}
                          variant="outline"
                          className="max-w-full rounded-full border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#71717a]"
                          title={project.name}
                        >
                          <span className="truncate">{project.name}</span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#71717a]">No projects selected.</p>
                  )}

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
                    <Input
                      value={projectSearchQuery}
                      onChange={(event) => setProjectSearchQuery(event.target.value)}
                      placeholder="Search projects..."
                      className="h-8 rounded-lg border-0 bg-white pl-8 pr-2 text-sm text-[#1f2937]"
                    />
                  </div>

                  <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                    {filteredSwimlanes.length > 0 ? (
                      filteredSwimlanes.map(swimlane => {
                        const isChecked = projectIds.includes(swimlane.id);
                        return (
                          <label
                            key={swimlane.id}
                            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-white"
                          >
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
                              className="h-4 w-4 rounded border-[#71717a]/20"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-[#1f2937]">{swimlane.name}</span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-dashed border-[#71717a]/10 bg-white px-3 py-3 text-sm text-[#71717a]">
                        No projects match "{projectSearchQuery}".
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="swimlane">Primary Timeline Project</Label>
                <Select value={swimlaneId} onValueChange={setSwimlaneId}>
                  <SelectTrigger
                    id="swimlane"
                    className="relative h-8 rounded-lg border-0 bg-[#71717a]/5 pl-8 pr-8 text-sm text-[#1f2937]"
                    disabled={projectIds.length === 0}
                  >
                    <Briefcase className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
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
                    <SelectTrigger id="assignee" className="relative h-8 rounded-lg border-0 bg-[#71717a]/5 pl-8 pr-8 text-sm text-[#1f2937]">
                      <User className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
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
                  <Label htmlFor="roadmap-milestone">Milestone</Label>
                  <Select
                    value={milestoneId}
                    onValueChange={setMilestoneId}
                    disabled={availableMilestones.length === 0}
                  >
                    <SelectTrigger id="roadmap-milestone" className="relative h-8 rounded-xl border-0 bg-white pl-2 pr-8 text-sm font-medium text-[#67676f] shadow-[0_0_0.5px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.06)]">
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

          {swimlaneId !== NO_TIMELINE_VALUE && (
            <AnchoredPanelSection
              id="task-edit-schedule"
              title="Schedule"
            >
              <div className="grid grid-cols-1 gap-x-2 gap-y-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
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
                      className="h-8 rounded-lg border-0 bg-[#71717a]/5 pl-8 pr-2 text-sm text-[#1f2937]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
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
                      className="h-8 rounded-lg border-0 bg-[#71717a]/5 pl-8 pr-2 text-sm text-[#1f2937]"
                    />
                  </div>
                  {hasInvalidDateRange && (
                    <p className="text-xs text-red-600">End date cannot be earlier than start date.</p>
                  )}
                </div>
              </div>
            </AnchoredPanelSection>
          )}

          <AnchoredPanelSection
            id="task-edit-description"
            title="Description"
          >
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="notes">Notes & Details</Label>
                <p className="hidden text-xs text-[#8a8a92] md:block">
                  {task ? 'Edit the task details below.' : 'Enter the task details below.'}
                </p>
              </div>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Write notes in markdown..."
                className="min-h-[125px] w-full resize-y rounded-xl border border-[#71717a]/10 bg-white p-4 text-sm leading-relaxed text-[#1f2937] outline-none focus:border-[#71717a]/30"
              />
            </div>
          </AnchoredPanelSection>

          <AnchoredPanelSection
            id="task-edit-attachments"
            title="Attachments"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Attachments</Label>
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
                <div className="rounded-xl border border-dashed border-[#71717a]/10 bg-[#71717a]/5 px-4 py-3 text-sm text-[#71717a]">
                  No files attached.
                </div>
              )}
            </div>
          </AnchoredPanelSection>
        </AnchoredPanel>
      </DialogContent>
    </Dialog>
  );
}
