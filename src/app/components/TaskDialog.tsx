import { useState, useEffect } from 'react';
import { Briefcase, CalendarDays, User } from 'lucide-react';
import { Task, TaskStatus, TimelineSwimlane, Person } from '../types';
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
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('open');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [swimlaneId, setSwimlaneId] = useState(NO_PROJECT_VALUE);
  const [assigneeId, setAssigneeId] = useState('unassigned');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setNotes(task.notes || '');
      setStartDate(task.startDate || '');
      setEndDate(task.endDate || '');
      setSwimlaneId(task.swimlaneId || NO_PROJECT_VALUE);
      setAssigneeId(task.assigneeId || 'unassigned');
    } else {
      setTitle('');
      setStatus(defaultStatus || 'open');
      setNotes('');
      setSwimlaneId(defaultSwimlaneId || NO_PROJECT_VALUE);
      setAssigneeId(defaultAssigneeId || 'unassigned');
      
      if (defaultDate) {
        const dateStr = toLocalISODate(defaultDate);
        setStartDate(dateStr);
        const endDateObj = defaultEndDate || new Date(defaultDate);
        if (!defaultEndDate) {
          endDateObj.setDate(endDateObj.getDate() + 2);
        }
        setEndDate(toLocalISODate(endDateObj));
      } else {
        setStartDate('');
        setEndDate('');
      }
    }
  }, [task, defaultStatus, defaultDate, defaultEndDate, defaultSwimlaneId, defaultAssigneeId, isOpen]);

  const handleSave = () => {
    if (!title.trim()) return;

    const taskData: Partial<Task> = {
      ...(task && { id: task.id }),
      title: title.trim(),
      status,
      notes: notes.trim(),
      swimlaneOnly: swimlaneId === NO_PROJECT_VALUE,
      swimlaneId: swimlaneId === NO_PROJECT_VALUE ? undefined : swimlaneId,
      assigneeId: assigneeId === 'unassigned' ? undefined : assigneeId,
    };

    if (swimlaneId !== NO_PROJECT_VALUE && startDate && endDate) {
      taskData.startDate = startDate;
      taskData.endDate = endDate;
    } else {
      taskData.startDate = undefined;
      taskData.endDate = undefined;
    }

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
      <DialogContent className="sm:max-w-[760px] rounded-2xl border-0 p-0">
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
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="swimlane">Assign to Swimlane</Label>
              <Select value={swimlaneId} onValueChange={setSwimlaneId}>
                <SelectTrigger id="swimlane" className="relative h-11 rounded-xl border-0 bg-gray-100 pl-10 pr-10">
                  <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-700" />
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT_VALUE}>No project (Kanban only)</SelectItem>
                  {swimlanes.map(swimlane => (
                    <SelectItem key={swimlane.id} value={swimlane.id}>
                      {swimlane.name}
                    </SelectItem>
                  ))}
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

          {swimlaneId !== NO_PROJECT_VALUE && (
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
