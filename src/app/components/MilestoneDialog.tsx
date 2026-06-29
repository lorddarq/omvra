import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ProjectMilestone, Task, TimelineSwimlane } from '../types';
import { getMilestoneProjectIds } from '../utils/roadmap';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import {
  Dialog,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { DialogSurface, DialogSurfaceHeader, DialogSurfaceSection } from './DialogSurface';
import { EmptyStateCard } from './EmptyStateCard';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  taskEditFieldClassName,
  taskEditLabelClassName,
  taskEditTextAreaClassName,
} from './taskFormStyles';

const milestoneDialogCheckboxCardClassName = 'flex cursor-pointer items-center gap-3 rounded-2xl border border-black/6 bg-white px-3 py-3 text-sm transition-colors hover:bg-[#f7f7f8]';
const milestoneDialogSearchInputClassName = `${taskEditFieldClassName} h-10 rounded-2xl bg-white`;

interface MilestoneDialogProps {
  isOpen: boolean;
  milestone?: ProjectMilestone | null;
  projects: TimelineSwimlane[];
  tasks: Task[];
  readModel?: WorkspaceReadModel;
  onClose: () => void;
  onSave: (milestone: ProjectMilestone) => void;
  onUpdateTaskDependencies?: (updates: Array<{ taskId: string; dependencyIds: string[] }>) => void;
  onDelete?: (milestoneId: string) => void;
}

export function MilestoneDialog({
  isOpen,
  milestone,
  projects,
  tasks,
  readModel,
  onClose,
  onSave,
  onUpdateTaskDependencies,
  onDelete,
}: MilestoneDialogProps) {
  const defaultProjectId = projects[0]?.id || '';
  const [title, setTitle] = useState('');
  const [projectIds, setProjectIds] = useState<string[]>(defaultProjectId ? [defaultProjectId] : []);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
  const [dependencyIdsByTaskId, setDependencyIdsByTaskId] = useState<Record<string, string[]>>({});
  const [taskSearchQuery, setTaskSearchQuery] = useState('');

  useEffect(() => {
    setTitle(milestone?.title || '');
    setProjectIds(milestone ? getMilestoneProjectIds(milestone) : defaultProjectId ? [defaultProjectId] : []);
    setStartDate(milestone?.startDate || '');
    setEndDate(milestone?.endDate || '');
    setNotes(milestone?.notes || '');
    const firstProjectId = milestone ? getMilestoneProjectIds(milestone)[0] : defaultProjectId;
    setColor(milestone?.color || projects.find(project => project.id === firstProjectId)?.color || '#3b82f6');
    setLinkedTaskIds(milestone?.linkedTaskIds || []);
    setDependencyIdsByTaskId(
      Object.fromEntries(tasks.map(task => [task.id, Array.isArray(task.dependencyIds) ? task.dependencyIds : []]))
    );
    setTaskSearchQuery('');
  }, [defaultProjectId, milestone, projects, tasks]);

  const projectTasks = useMemo(() => {
    if (readModel) {
      return readModel.tasks
        .filter(task => task.projects.some(project => projectIds.includes(project.id)))
        .map(task => task.task);
    }

    return tasks.filter(task => {
      const taskProjectIds = task.projectIds?.length ? task.projectIds : task.swimlaneId ? [task.swimlaneId] : [];
      return taskProjectIds.some(projectId => projectIds.includes(projectId));
    });
  }, [projectIds, readModel, tasks]);
  const filteredProjectTasks = useMemo(() => {
    const normalizedSearch = taskSearchQuery.trim().toLowerCase();
    if (!normalizedSearch) return projectTasks;

    return projectTasks.filter(task => {
      const taskProjectIds = task.projectIds?.length ? task.projectIds : task.swimlaneId ? [task.swimlaneId] : [];
      const projectLabels = taskProjectIds
        .map(projectId => projects.find(project => project.id === projectId)?.name)
        .filter(Boolean)
        .join(' ');
      const haystack = [
        task.title,
        task.notes,
        task.status,
        projectLabels,
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [projectTasks, projects, taskSearchQuery]);

  const toggleProject = (projectId: string) => {
    setProjectIds(prev => {
      const nextProjectIds = prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId];
      const nextProjectIdSet = new Set(nextProjectIds);

      setLinkedTaskIds(previousTaskIds =>
        previousTaskIds.filter(taskId => {
          const task = tasks.find(item => item.id === taskId);
          if (!task) return false;
          const taskProjectIds = task.projectIds?.length ? task.projectIds : task.swimlaneId ? [task.swimlaneId] : [];
          return taskProjectIds.some(id => nextProjectIdSet.has(id));
        })
      );

      return nextProjectIds;
    });
  };

  const toggleTask = (taskId: string) => {
    setLinkedTaskIds(prev => {
      if (!prev.includes(taskId)) return [...prev, taskId];

      const nextLinkedTaskIds = prev.filter(id => id !== taskId);
      setDependencyIdsByTaskId(previousMap => {
        const nextMap = { ...previousMap };
        delete nextMap[taskId];
        Object.keys(nextMap).forEach(dependentTaskId => {
          nextMap[dependentTaskId] = (nextMap[dependentTaskId] || []).filter(id => id !== taskId);
        });
        return nextMap;
      });
      return nextLinkedTaskIds;
    });
  };

  const toggleDependency = (taskId: string, dependencyId: string) => {
    if (taskId === dependencyId) return;
    setDependencyIdsByTaskId(prev => {
      const currentDependencyIds = prev[taskId] || [];
      const nextDependencyIds = currentDependencyIds.includes(dependencyId)
        ? currentDependencyIds.filter(id => id !== dependencyId)
        : [...currentDependencyIds, dependencyId];

      return {
        ...prev,
        [taskId]: nextDependencyIds,
      };
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || projectIds.length === 0 || !endDate) return;

    const sanitizedLinkedTaskIds = linkedTaskIds.filter(taskId =>
      projectTasks.some(task => task.id === taskId)
    );

    onUpdateTaskDependencies?.(
      sanitizedLinkedTaskIds.map(taskId => ({
        taskId,
        dependencyIds: (dependencyIdsByTaskId[taskId] || []).filter(
          dependencyId => dependencyId !== taskId && sanitizedLinkedTaskIds.includes(dependencyId)
        ),
      }))
    );

    onSave({
      id: milestone?.id || Date.now().toString(),
      convexId: milestone?.convexId,
      title: title.trim(),
      projectIds,
      projectId: projectIds[0],
      startDate: startDate || undefined,
      endDate,
      notes: notes.trim() || undefined,
      color,
      linkedTaskIds: sanitizedLinkedTaskIds,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogSurface className="sm:max-w-[760px]">
        <form onSubmit={handleSubmit}>
          <DialogSurfaceHeader
            title={milestone ? 'Edit roadmap milestone' : 'Create roadmap milestone'}
            description="Milestones can be scoped to one product or span multiple projects under a shared release frame."
          />

          <div className="grid gap-5 px-6 py-5">
            <div className="grid gap-2">
              <Label htmlFor="milestone-title" className={taskEditLabelClassName}>Title</Label>
              <Input
                id="milestone-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g., Launch readiness review"
                className={taskEditFieldClassName}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label className={taskEditLabelClassName}>Projects</Label>
              <DialogSurfaceSection className="grid gap-2 sm:grid-cols-2">
                {projects.map(project => {
                  const isChecked = projectIds.includes(project.id);
                  return (
                    <label
                      key={project.id}
                      className={`${milestoneDialogCheckboxCardClassName} ${isChecked ? 'border-[#1a60cb]/15 bg-[#edf3ff]' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleProject(project.id)}
                        className="size-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: project.color || '#3b82f6' }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 truncate font-medium text-[#1f2937]">{project.name}</span>
                    </label>
                  );
                })}
              </DialogSurfaceSection>
              <p className="text-xs leading-5 text-[#7b8190]">
                Select one project for product-specific milestones, or multiple projects for release-frame milestones.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="milestone-start" className={taskEditLabelClassName}>Start date</Label>
                <Input
                  id="milestone-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={taskEditFieldClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="milestone-end" className={taskEditLabelClassName}>End date</Label>
                <Input
                  id="milestone-end"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={taskEditFieldClassName}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="milestone-color" className={taskEditLabelClassName}>Color</Label>
              <Input
                id="milestone-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-11 w-24 rounded-2xl border border-black/8 bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="milestone-notes" className={taskEditLabelClassName}>Notes</Label>
              <Textarea
                id="milestone-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Goal details, launch criteria, or manager notes."
                rows={4}
                className={taskEditTextAreaClassName}
              />
            </div>

            <DialogSurfaceSection>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#111827]">Linked tasks</h3>
                  <p className="text-sm text-[#6b7280]">These tasks drive the milestone rollup and deadline flags.</p>
                </div>
                <span className="rounded-full border border-black/6 bg-white px-2.5 py-1 text-xs font-medium text-[#6b7280]">
                  {linkedTaskIds.length} selected
                </span>
              </div>
              <div className="mb-3">
                <Label htmlFor="milestone-task-search" className="sr-only">Search milestone tasks</Label>
                <Input
                  id="milestone-task-search"
                  value={taskSearchQuery}
                  onChange={(event) => setTaskSearchQuery(event.target.value)}
                  placeholder="Search tasks by title, notes, status, or project..."
                  className={milestoneDialogSearchInputClassName}
                />
              </div>
              {projectTasks.length === 0 ? (
                <EmptyStateCard
                  compact
                  title="No tasks in this project scope"
                  description="Add tasks to the selected roadmap projects first, then link the milestone work from this list."
                />
              ) : filteredProjectTasks.length === 0 ? (
                <EmptyStateCard
                  compact
                  title="No tasks match this search"
                  description="Try a different task title, status, note, or project keyword to find the right milestone work."
                />
              ) : (
                <div className="grid gap-2">
                  {filteredProjectTasks.map(task => {
                    const isLinked = linkedTaskIds.includes(task.id);
                    const dependencyOptions = projectTasks.filter(
                      option => option.id !== task.id && linkedTaskIds.includes(option.id)
                    );
                    return (
                      <div
                        key={task.id}
                        className={`rounded-2xl border p-3 text-sm transition-colors ${
                          isLinked
                            ? 'border-[#1a60cb]/15 bg-[#edf3ff]'
                            : 'border-black/6 bg-white hover:bg-[#f8fafc]'
                        }`}
                      >
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isLinked}
                            onChange={() => toggleTask(task.id)}
                            aria-label={`Link ${task.title} to this milestone`}
                            className="size-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-[#1f2937]">{task.title}</span>
                          <span className="rounded-full border border-black/6 bg-white px-2 py-0.5 text-xs text-[#6b7280]">{task.status}</span>
                        </label>

                        {isLinked && dependencyOptions.length > 0 && (
                          <div className="mt-3 border-l border-[#dbe4f1] pl-7">
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#7b8190]">
                              Depends on
                            </div>
                            <div className="grid gap-1.5">
                              {dependencyOptions.map(option => (
                                <label key={option.id} className="flex cursor-pointer items-center gap-2 text-xs text-[#4b5563]">
                                  <input
                                    type="checkbox"
                                    checked={(dependencyIdsByTaskId[task.id] || []).includes(option.id)}
                                    onChange={() => toggleDependency(task.id, option.id)}
                                    aria-label={`${task.title} depends on ${option.title}`}
                                    className="size-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                  />
                                  <span className="min-w-0 truncate">{option.title}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DialogSurfaceSection>
          </div>

          <DialogFooter className="gap-2 border-t border-black/6 px-6 py-5">
            {milestone && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDelete(milestone.id)}
                className="mr-auto h-10 rounded-2xl"
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} className="h-10 rounded-2xl">
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || projectIds.length === 0 || !endDate} className="h-10 rounded-2xl">
              Save milestone
            </Button>
          </DialogFooter>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
