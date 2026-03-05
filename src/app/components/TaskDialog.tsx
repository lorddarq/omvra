import { useState, useEffect } from 'react';
import { Briefcase, CalendarDays, User } from 'lucide-react';
import { Task, TaskStatus, TimelineSwimlane, Person, TaskSize, TaskComplexity } from '../types';
import { toLocalISODate } from '../utils/date';
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
import { Textarea } from '@/app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

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
  statusColumns?: Array<{ id: TaskStatus; title: string; color?: string }>;
  people?: Person[];
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
}: TaskDialogProps) {
  const NO_PROJECT_VALUE = 'none';
  const NO_TIMELINE_VALUE = 'none';
  const todayISO = toLocalISODate(new Date());
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('open');
  const [notes, setNotes] = useState('');
  const [size, setSize] = useState<TaskSize>('m');
  const [complexity, setComplexity] = useState<TaskComplexity>('medium');
  const [blocked, setBlocked] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [swimlaneId, setSwimlaneId] = useState(NO_TIMELINE_VALUE);
  const [assigneeId, setAssigneeId] = useState('unassigned');

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
      setBlocked(Boolean(task.blocked));
      setStartDate(existingStart);
      setEndDate(existingEnd);
      setProjectIds(initialProjectIds);
      setSwimlaneId(task.swimlaneId || (initialProjectIds[0] || NO_TIMELINE_VALUE));
      setAssigneeId(task.assigneeId || 'unassigned');
    } else {
      const initialProjectIds = defaultSwimlaneId ? [defaultSwimlaneId] : [];
      setTitle('');
      setStatus(defaultStatus || 'open');
      setNotes('');
      setSize('m');
      setComplexity('medium');
      setBlocked(false);
      setProjectIds(initialProjectIds);
      setSwimlaneId(defaultSwimlaneId || NO_TIMELINE_VALUE);
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
  }, [task, defaultStatus, defaultDate, defaultEndDate, defaultSwimlaneId, defaultAssigneeId, isOpen, todayISO]);

  const handleSave = () => {
    if (!title.trim()) return;

    const taskData: Partial<Task> = {
      ...(task && { id: task.id }),
      title: title.trim(),
      status,
      notes: notes.trim(),
      size,
      complexity,
      blocked,
      projectIds,
      swimlaneOnly: projectIds.length === 0 || swimlaneId === NO_TIMELINE_VALUE,
      swimlaneId: swimlaneId === NO_TIMELINE_VALUE ? undefined : swimlaneId,
      project: projectIds
        .map(id => swimlanes.find(s => s.id === id)?.name)
        .filter(Boolean)
        .join(', ') || undefined,
      assigneeId: assigneeId === 'unassigned' ? undefined : assigneeId,
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
                        {person.name} - {person.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                    onChange={(e) => setStartDate(e.target.value)}
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
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11 rounded-xl border-0 bg-gray-100 pl-10 pr-4"
                  />
                </div>
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
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder=""
              className="min-h-[240px] rounded-xl border-0 bg-gray-100 p-4"
            />
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
            disabled={!title.trim()}
            className="h-10 rounded-xl bg-[#020329] px-5 hover:bg-[#020329]/90"
          >
            {task ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
