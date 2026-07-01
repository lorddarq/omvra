import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ProjectMilestone, Task, TimelineSwimlane } from '../types';
import { getMilestoneProjectIds, wouldCreateDependencyCycle } from '../utils/roadmap';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import {
  Dialog,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { DialogSurface, DialogSurfaceHeader, DialogSurfaceSection } from './DialogSurface';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { MilestoneTaskLinker } from './MilestoneSections';
import { Textarea } from './ui/textarea';
import {
  taskEditFieldClassName,
  taskEditLabelClassName,
  taskEditTextAreaClassName,
} from './taskFormStyles';

const milestoneDialogCheckboxCardClassName = 'flex cursor-pointer items-center gap-3 rounded-2xl border border-black/6 bg-white px-3 py-3 text-sm transition-colors hover:bg-[#f7f7f8]';

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
      const isRemoving = currentDependencyIds.includes(dependencyId);
      const nextDependencyIds = isRemoving
        ? currentDependencyIds.filter(id => id !== dependencyId)
        : [...currentDependencyIds, dependencyId];

      if (
        !isRemoving
        && wouldCreateDependencyCycle(taskId, dependencyId, currentTaskId => {
          if (currentTaskId === taskId) return nextDependencyIds;
          return prev[currentTaskId] || [];
        })
      ) {
        return prev;
      }

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

            <MilestoneTaskLinker
              projectTasks={projectTasks}
              filteredProjectTasks={filteredProjectTasks}
              linkedTaskIds={linkedTaskIds}
              dependencyIdsByTaskId={dependencyIdsByTaskId}
              taskSearchQuery={taskSearchQuery}
              onTaskSearchQueryChange={setTaskSearchQuery}
              onToggleTask={toggleTask}
              onToggleDependency={toggleDependency}
            />
          </div>

          <DialogFooter className="gap-2 border-t border-black/6 px-6 py-5">
            {milestone && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteConfirmOpen(true)}
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

      <DeleteConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete milestone?"
        description="This removes the milestone and clears milestone-linked dependency wiring from the affected tasks."
        confirmLabel="Delete milestone"
        onOpenChange={setDeleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (!milestone || !onDelete) return;
          onDelete(milestone.id);
          setDeleteConfirmOpen(false);
          onClose();
        }}
      />
    </Dialog>
  );
}
