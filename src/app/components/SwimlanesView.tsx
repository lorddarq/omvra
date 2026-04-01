import { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical } from 'lucide-react';
import { Task, TaskStatus, StatusColumn } from '../types';
import { DroppableColumn } from './DroppableColumn';

const SWIMLANE_COLUMN = 'SWIMLANE_COLUMN';

// Small component to encapsulate per-column hooks safely (prevents hook-order mismatches)
function ColumnDraggable<T extends { id: string; title?: string; color?: string }>({
  swimlane,
  index,
  swimlaneTasks,
  swimlanes,
  onTaskClick,
  onEditTask,
  onAddTask,
  onMoveTask,
  onReorderTask,
  onRenameColumn,
  onChangeColumnColor,
  onDeleteColumn,
  onReorderColumns,
}: {
  swimlane: T;
  index: number;
  swimlaneTasks: Task[];
  swimlanes: StatusColumn[];
  onTaskClick: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onReorderTask: (dragIndex: number, hoverIndex: number, status: TaskStatus) => void;
  onRenameColumn?: (colId: string, newTitle: string) => void;
  onChangeColumnColor?: (colId: string, newColor: string) => void;
  onDeleteColumn?: (colId: string) => void;
  onReorderColumns?: (fromIndex: number, toIndex: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [{ isDragging }, drag] = useDrag({
    type: SWIMLANE_COLUMN,
    item: { id: swimlane.id, index },
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  const [, drop] = useDrop({
    accept: SWIMLANE_COLUMN,
    hover: (item: { id: string; index: number }, monitor) => {
      const dragIndex = swimlanes.findIndex(column => column.id === item.id);
      const resolvedDragIndex = dragIndex >= 0 ? dragIndex : item.index;
      if (resolvedDragIndex === index) return;
      if (!ref.current) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const hoverClientX = clientOffset.x - hoverBoundingRect.left;
      if (resolvedDragIndex < index && hoverClientX < hoverMiddleX) return;
      if (resolvedDragIndex > index && hoverClientX > hoverMiddleX) return;

      onReorderColumns && onReorderColumns(resolvedDragIndex, index);
      item.index = index;
    },
  });

  drag(drop(ref));

  return (
    <div
      key={swimlane.id}
      ref={ref}
      className={`flex h-full min-h-0 flex-col ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2 cursor-grab select-none">
        <div className="p-1 text-gray-500"><GripVertical className="w-4 h-4" /></div>
      </div>

      <DroppableColumn
        swimlane={swimlane as any}
        tasks={swimlaneTasks}
        swimlanes={swimlanes}
        onTaskClick={onTaskClick}
        onEditTask={onEditTask}
        onAddTask={onAddTask}
        onMoveTask={onMoveTask}
        onReorderTask={onReorderTask}
        onRenameColumn={onRenameColumn}
        onChangeColumnColor={onChangeColumnColor}
        onDeleteColumn={onDeleteColumn}
      />
    </div>
  );
}

interface SwimlanesViewProps {
  tasks: Task[];
  swimlanes: StatusColumn[];
  searchQuery?: string;
  onTaskClick: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onReorderTasks: (tasks: Task[]) => void;
  onReorderColumns?: (fromIndex: number, toIndex: number) => void;
  onRenameColumn?: (colId: string, newTitle: string) => void;
  onChangeColumnColor?: (colId: string, newColor: string) => void;
  onAddColumn?: (col: { id?: string; title: string; color?: string }) => void;
  onDeleteColumn?: (colId: string) => void;
}
export function SwimlanesView({
  tasks,
  swimlanes,
  searchQuery = '',
  onTaskClick,
  onEditTask,
  onAddTask,
  onMoveTask,
  onReorderTasks,
  onReorderColumns,
  onRenameColumn,
  onChangeColumnColor,
  onAddColumn,
  onDeleteColumn,
}: SwimlanesViewProps) {
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const isSearchActive = trimmedSearch.length > 0;

  const matchesTaskSearch = (task: Task) => {
    if (!isSearchActive) return true;
    const haystack = `${task.title} ${task.notes || ''}`.toLowerCase();
    return haystack.includes(trimmedSearch);
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status);
  };

  const getVisibleTasksByStatus = (status: string) => {
    return getTasksByStatus(status).filter(matchesTaskSearch);
  };

  const handleReorderTask = (dragIndex: number, hoverIndex: number, status: TaskStatus) => {
    // Reordering while filtered can mismatch indices, so keep it disabled during search.
    if (isSearchActive) return;

    const statusTasks = getTasksByStatus(status);
    const reorderedTasks = [...statusTasks];
    const [draggedTask] = reorderedTasks.splice(dragIndex, 1);
    reorderedTasks.splice(hoverIndex, 0, draggedTask);

    // Merge reordered tasks with tasks from other statuses
    const otherTasks = tasks.filter(task => task.status !== status);
    onReorderTasks([...otherTasks, ...reorderedTasks]);
  };

  // Defensive: ensure we have an array to map over
  const cols = Array.isArray(swimlanes) ? swimlanes : [];
  if (!Array.isArray(swimlanes)) {
    // eslint-disable-next-line no-console
    console.warn('[SwimlanesView] expected `swimlanes` array but got:', swimlanes);
  }

  return (
      <div className="h-full min-h-0 bg-gray-50 p-6 pb-3">
        <div className="flex h-full min-h-0 min-w-max items-stretch gap-4">
        {cols.map((swimlane, index) => {
            const swimlaneTasks = getVisibleTasksByStatus(swimlane.id);
            return (
              <ColumnDraggable
                key={swimlane.id}
                swimlane={swimlane}
                index={index}
                swimlaneTasks={swimlaneTasks}
                swimlanes={swimlanes}
                onTaskClick={onTaskClick}
                onEditTask={onEditTask}
                onAddTask={onAddTask}
                onMoveTask={onMoveTask}
                onReorderTask={handleReorderTask}
                onRenameColumn={onRenameColumn}
                onChangeColumnColor={onChangeColumnColor}
                onDeleteColumn={onDeleteColumn}
                onReorderColumns={onReorderColumns}
              />
            );
          })}

        </div>
      </div>
  );
}
