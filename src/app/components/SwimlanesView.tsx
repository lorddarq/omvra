import { Fragment, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical } from 'lucide-react';
import { Task, TaskStatus, StatusColumn } from '../types';
import { DroppableColumn } from './DroppableColumn';

const SWIMLANE_COLUMN = 'SWIMLANE_COLUMN';
const COLUMN_REORDER_EDGE_RATIO = 0.25;

interface ColumnDragItem {
  id: string;
  index: number;
}

interface ColumnDropIndicator {
  targetId: string;
  position: 'before' | 'after';
}

function ColumnInsertionMarker() {
  return (
    <div
      className="pointer-events-none relative flex w-[320px] shrink-0 items-stretch justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/70"
      aria-hidden="true"
    >
      <div className="absolute bottom-3 top-10 z-20 w-1 rounded-full bg-blue-500 shadow-sm" />
    </div>
  );
}

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
  onColumnDragHover,
  onColumnDropIndicatorChange,
  onColumnDropIndicatorClear,
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
  onColumnDragHover?: (clientX: number) => void;
  onColumnDropIndicatorChange: (indicator: ColumnDropIndicator) => void;
  onColumnDropIndicatorClear: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement | null>(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: SWIMLANE_COLUMN,
    item: { id: swimlane.id, index },
    collect: (m) => ({ isDragging: m.isDragging() }),
    end: () => {
      onColumnDropIndicatorClear();
    },
  });

  const [, drop] = useDrop({
    accept: SWIMLANE_COLUMN,
    hover: (item: ColumnDragItem, monitor) => {
      const clientOffset = monitor.getClientOffset();
      if (clientOffset) {
        onColumnDragHover?.(clientOffset.x);
      }

      const dragIndex = swimlanes.findIndex(column => column.id === item.id);
      const resolvedDragIndex = dragIndex >= 0 ? dragIndex : item.index;
      if (resolvedDragIndex === index) return;
      if (!ref.current) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      if (!clientOffset) return;

      const hoverClientX = clientOffset.x - hoverBoundingRect.left;
      const columnWidth = hoverBoundingRect.right - hoverBoundingRect.left;
      const forwardTriggerX = columnWidth * COLUMN_REORDER_EDGE_RATIO;
      const backwardTriggerX = columnWidth * (1 - COLUMN_REORDER_EDGE_RATIO);
      const isMovingForward = resolvedDragIndex < index;

      onColumnDropIndicatorChange({
        targetId: swimlane.id,
        position: isMovingForward ? 'after' : 'before',
      });

      if (isMovingForward && hoverClientX < forwardTriggerX) return;
      if (!isMovingForward && hoverClientX > backwardTriggerX) return;

      onReorderColumns && onReorderColumns(resolvedDragIndex, index);
      item.index = index;
    },
  });

  drag(dragHandleRef);
  preview(drop(ref));

  return (
    <div
      key={swimlane.id}
      ref={ref}
      data-kanban-column-id={swimlane.id}
      className={`relative flex h-full min-h-0 shrink-0 flex-col rounded-xl transition-[opacity,transform,box-shadow] duration-150 ${
        isDragging ? 'w-0 overflow-hidden opacity-0' : 'w-[320px]'
      }`}
    >
      <div className="mb-2 flex items-center gap-2 select-none">
        <button
          ref={dragHandleRef}
          type="button"
          className="inline-flex size-7 cursor-grab items-center justify-center rounded-md border border-transparent text-gray-500 transition-colors hover:border-gray-200 hover:bg-white hover:text-gray-800 active:cursor-grabbing"
          aria-label={`Drag ${swimlane.title || 'column'} column`}
        >
          <GripVertical className="size-4" />
        </button>
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
  isFilterActive?: boolean;
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
  onColumnDragHover?: (clientX: number) => void;
}
export function SwimlanesView({
  tasks,
  swimlanes,
  isFilterActive = false,
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
  onColumnDragHover,
}: SwimlanesViewProps) {
  const [columnDropIndicator, setColumnDropIndicator] = useState<ColumnDropIndicator | null>(null);

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status);
  };

  const handleReorderTask = (dragIndex: number, hoverIndex: number, status: TaskStatus) => {
    // Reordering while filtered can mismatch visible indices with the full task order.
    if (isFilterActive) return;

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
        {isFilterActive && tasks.length === 0 && (
          <div className="mb-4 rounded-md border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-600">
            No tasks match the current filters.
          </div>
        )}
        <div className="flex h-full min-h-0 min-w-max items-stretch gap-4">
        {cols.map((swimlane, index) => {
            const swimlaneTasks = getTasksByStatus(swimlane.id);
            return (
              <Fragment key={swimlane.id}>
                {columnDropIndicator?.targetId === swimlane.id && columnDropIndicator.position === 'before' && (
                  <ColumnInsertionMarker />
                )}
                <ColumnDraggable
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
                  onColumnDragHover={onColumnDragHover}
                  onColumnDropIndicatorChange={setColumnDropIndicator}
                  onColumnDropIndicatorClear={() => setColumnDropIndicator(null)}
                />
                {columnDropIndicator?.targetId === swimlane.id && columnDropIndicator.position === 'after' && (
                  <ColumnInsertionMarker />
                )}
              </Fragment>
            );
          })}

        </div>
      </div>
  );
}
