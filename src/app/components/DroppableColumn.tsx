import { Fragment, useRef, useState, type RefObject } from 'react';
import { useDragLayer, useDrop } from 'react-dnd';
import { GripVertical } from 'lucide-react';
import { Task, TaskStatus, StatusColumn } from '../types';
import {
  DraggableTaskCard,
  TASK_ITEM_TYPE,
  type TaskDragItem,
  type TaskDropIndicator,
} from '../components/DraggableTaskCard';
import { ColumnDialog } from '../components/ColumnDialog';

interface DroppableColumnProps {
  swimlane: StatusColumn;
  tasks: Task[];
  swimlanes: StatusColumn[];
  columnDragHandleRef?: RefObject<HTMLButtonElement | null>;
  onTaskClick: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onDropTask: (draggedTask: Task, targetStatus: TaskStatus, targetIndex: number) => void;
  onRenameColumn?: (colId: string, newTitle: string) => void;
  onChangeColumnColor?: (colId: string, newColor: string) => void;
  onDeleteColumn?: (colId: string) => void;
}

function TaskInsertionMarker({
  indicator,
  onTaskDrop,
  onTaskDropIndicatorClear,
}: {
  indicator: TaskDropIndicator;
  onTaskDrop: (draggedTask: Task, targetStatus: TaskStatus, indicator: TaskDropIndicator) => void;
  onTaskDropIndicatorClear: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [, drop] = useDrop({
    accept: TASK_ITEM_TYPE,
    drop: (item: TaskDragItem) => {
      onTaskDrop(item.task, indicator.status, indicator);
      onTaskDropIndicatorClear();
    },
  });

  drop(ref);

  return (
    <div
      ref={ref}
      className="reserved-slot reserved-slot--interactive reserved-slot--kanban-task"
      style={{ height: `${indicator.draggedSize?.height ?? 92}px` }}
      aria-hidden="true"
    />
  );
}

function getColumnAccentStyle(color: string | undefined): React.CSSProperties | undefined {
  if (!color?.startsWith('#')) return undefined;
  return { '--kanban-column-accent': color } as React.CSSProperties;
}

function getColumnAccentClass(color: string | undefined): string {
  if (!color || color.startsWith('#')) return '';
  return color;
}

interface KanbanColumnHeaderProps {
  swimlane: StatusColumn;
  taskCount: number;
  columnDragHandleRef?: RefObject<HTMLButtonElement | null>;
  onEdit: () => void;
}

function KanbanColumnHeader({
  swimlane,
  taskCount,
  columnDragHandleRef,
  onEdit,
}: KanbanColumnHeaderProps) {
  return (
    <div className="kanban-column-header-ui">
      {columnDragHandleRef && (
        <button
          ref={columnDragHandleRef}
          type="button"
          className="kanban-column-drag-handle"
          aria-label={`Drag ${swimlane.title || 'column'} column`}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <div className={`kanban-column-accent ${getColumnAccentClass(swimlane.color)}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="kanban-column-title-row">
          <span className="kanban-column-title-text">{swimlane.title}</span>
          <span className="kanban-column-count-pill">{taskCount}</span>
        </div>
      </div>
      <button
        className="kanban-column-edit-control"
        onClick={onEdit}
        aria-label={`Edit ${swimlane.title} column`}
        type="button"
      >
        Edit
      </button>
    </div>
  );
}

interface KanbanAddTaskRowProps {
  onAddTask: () => void;
}

function KanbanAddTaskRow({ onAddTask }: KanbanAddTaskRowProps) {
  return (
    <button
      onClick={onAddTask}
      className="kanban-add-task-row"
      type="button"
    >
      <span>Add Task</span>
    </button>
  );
}

export function DroppableColumn({
  swimlane,
  tasks: swimlaneTasks,
  swimlanes,
  columnDragHandleRef,
  onTaskClick,
  onEditTask,
  onAddTask,
  onMoveTask,
  onDropTask,
  onRenameColumn,
  onChangeColumnColor,
  onDeleteColumn,
}: DroppableColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [taskDropIndicator, setTaskDropIndicator] = useState<TaskDropIndicator | null>(null);
  const isTaskDragging = useDragLayer((monitor) => (
    monitor.isDragging() && monitor.getItemType() === TASK_ITEM_TYPE
  ));
  const visibleTaskDropIndicator = isTaskDragging ? taskDropIndicator : null;

  const getDropIndex = (indicator: TaskDropIndicator): number => {
    const targetIndex = swimlaneTasks.findIndex(task => task.id === indicator.targetTaskId);
    if (targetIndex < 0) return swimlaneTasks.length;
    return indicator.position === 'before' ? targetIndex : targetIndex + 1;
  };

  const handleTaskDrop = (draggedTask: Task, targetStatus: TaskStatus, fallbackIndicator: TaskDropIndicator) => {
    const indicator = taskDropIndicator?.status === targetStatus ? taskDropIndicator : fallbackIndicator;
    let insertionIndex = getDropIndex(indicator);
    const dragIndex = swimlaneTasks.findIndex(task => task.id === draggedTask.id);
    if (draggedTask.status === targetStatus && dragIndex >= 0 && dragIndex < insertionIndex) {
      insertionIndex -= 1;
    }

    onDropTask(draggedTask, targetStatus, insertionIndex);
  };

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: TASK_ITEM_TYPE,
    drop: (item: TaskDragItem, monitor) => {
      if (monitor.didDrop()) return;

      onDropTask(item.task, swimlane.id as TaskStatus, swimlaneTasks.length);
      setTaskDropIndicator(null);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  drop(ref);

  // Column dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSaveColumn = (title: string, color: string) => {
    if (onRenameColumn && title.trim()) onRenameColumn(swimlane.id, title.trim());
    if (onChangeColumnColor && color) onChangeColumnColor(swimlane.id, color);
  };

  const handleDeleteColumn = () => {
    if (onDeleteColumn) onDeleteColumn(swimlane.id);
  };

  return (
    <div
      className="kanban-column-shell"
      style={getColumnAccentStyle(swimlane.color)}
    >
      <KanbanColumnHeader
        swimlane={swimlane}
        taskCount={swimlaneTasks.length}
        columnDragHandleRef={columnDragHandleRef}
        onEdit={() => setIsDialogOpen(true)}
      />

      {/* Column Dialog */}
      <ColumnDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveColumn}
        onDelete={onDeleteColumn ? handleDeleteColumn : undefined}
        column={swimlane}
      />

      {/* Task cards */}
      <div
        ref={ref}
        className={`kanban-column-task-list ${isOver && canDrop ? 'is-over' : ''}`}
      >
        <KanbanAddTaskRow onAddTask={() => onAddTask(swimlane.id as TaskStatus)} />

        {swimlaneTasks.map((task, index) => (
          <Fragment key={task.id}>
            {visibleTaskDropIndicator?.targetTaskId === task.id && visibleTaskDropIndicator.position === 'before' && (
              <TaskInsertionMarker
                indicator={visibleTaskDropIndicator}
                onTaskDrop={handleTaskDrop}
                onTaskDropIndicatorClear={() => setTaskDropIndicator(null)}
              />
            )}
            <DraggableTaskCard
              task={task}
              index={index}
              onTaskClick={onTaskClick}
              onEditTask={onEditTask}
              onMoveTask={onMoveTask}
              onTaskDropIndicatorChange={setTaskDropIndicator}
              onTaskDropIndicatorClear={() => setTaskDropIndicator(null)}
              onTaskDrop={handleTaskDrop}
              swimlanes={swimlanes}
            />
            {visibleTaskDropIndicator?.targetTaskId === task.id && visibleTaskDropIndicator.position === 'after' && (
              <TaskInsertionMarker
                indicator={visibleTaskDropIndicator}
                onTaskDrop={handleTaskDrop}
                onTaskDropIndicatorClear={() => setTaskDropIndicator(null)}
              />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
