import { Task, TimelineSwimlane, Person, TaskStatus } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { MarkdownContent } from './MarkdownContent';

interface TaskDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  task?: Task | null;
  swimlanes: TimelineSwimlane[];
  people: Person[];
  statusColumns: Array<{ id: TaskStatus; title: string; color?: string }>;
}

function formatDate(dateValue?: string): string {
  if (!dateValue) return 'Not set';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString();
}

export function TaskDetailsDialog({
  isOpen,
  onClose,
  onEdit,
  task,
  swimlanes,
  people,
  statusColumns,
}: TaskDetailsDialogProps) {
  const swimlaneName = task?.swimlaneId
    ? swimlanes.find(s => s.id === task.swimlaneId)?.name ?? 'Unknown swimlane'
    : 'No swimlane';
  const personLabel = task?.assigneeId
    ? people.find(p => p.id === task.assigneeId)?.name ?? 'Unknown assignee'
    : 'Unassigned';
  const statusLabel = task
    ? statusColumns.find(c => c.id === task.status)?.title ?? task.status
    : '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{task?.title || 'Task details'}</DialogTitle>
          <DialogDescription>Review task details and markdown description.</DialogDescription>
        </DialogHeader>

        {task && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-gray-50 p-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
                <div className="text-sm font-medium text-gray-900">{statusLabel}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Swimlane</div>
                <div className="text-sm font-medium text-gray-900">{swimlaneName}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Assignee</div>
                <div className="text-sm font-medium text-gray-900">{personLabel}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Timeline</div>
                <div className="text-sm font-medium text-gray-900">
                  {formatDate(task.startDate)} - {formatDate(task.endDate)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">Description</div>
              <div className="max-h-[360px] overflow-y-auto rounded-md border bg-white p-4">
                {task.notes?.trim() ? (
                  <MarkdownContent content={task.notes} />
                ) : (
                  <div className="text-sm text-gray-500">No description provided.</div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {task && onEdit && (
            <Button
              variant="outline"
              className="mr-auto"
              onClick={() => onEdit(task)}
            >
              Edit
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
