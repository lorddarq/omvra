/**
 * KanbanView Component
 *
 * Full-page kanban board view with independent horizontal scrolling.
 * Integrates with useViewState to preserve scroll position across view switches.
 *
 * Renders kanban columns (swimlanes) in a responsive flex layout.
 * Columns grow to fill available width or overflow-scroll if total width exceeds viewport.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { Task, TaskStatus } from '../types';
import { SwimlanesView } from './SwimlanesView';
import { useViewState } from '../hooks/useViewState';
import { Input } from './ui/input';
import { Search } from 'lucide-react';

interface KanbanViewProps {
  tasks: Task[];
  swimlanes: Array<{ id: TaskStatus; title: string; color?: string }>;
  onTaskClick: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onReorderTasks: (tasks: Task[]) => void;
  onReorderColumns: (fromIndex: number, toIndex: number) => void;
  onRenameColumn?: (colId: string, newTitle: string) => void;
  onChangeColumnColor?: (colId: string, newColor: string) => void;
  onAddColumn?: (col: any) => void;
  onDeleteColumn?: (colId: string) => void;
}

export function KanbanView({
  tasks,
  swimlanes,
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
}: KanbanViewProps) {
  // Get view state from context (assuming parent provides it)
  // For now, we'll manage scroll locally but expose it for view state preservation
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Handle scroll events and preserve scroll position in view state.
   * The parent (App) will call saveViewState with this scroll position.
   */
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrollLeft = e.currentTarget.scrollLeft;
      const scrollTop = e.currentTarget.scrollTop;

      // Dispatch custom event so parent can capture scroll state
      // Alternatively, parent can access scrollLeft directly via ref
      const event = new CustomEvent('kanbanScroll', {
        detail: { scrollLeft, scrollTop },
      });
      document.dispatchEvent(event);
    },
    []
  );

  /**
   * Restore scroll position when component mounts (if state was saved).
   * Parent (App) should pass initial scrollLeft as prop or via context.
   */
  useEffect(() => {
    // Scroll restoration can be handled by parent component
    // by passing initialScrollLeft prop and using ref.current.scrollLeft = value
  }, []);

  return (
    <div className="h-full w-full bg-gray-50 flex flex-col">
      <div className="border-b bg-white px-4 py-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title or details..."
            className="pl-9"
          />
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-x-auto overflow-y-auto"
      >
      <SwimlanesView
        tasks={tasks}
        swimlanes={swimlanes}
        searchQuery={searchQuery}
        onTaskClick={onTaskClick}
        onEditTask={onEditTask}
        onAddTask={onAddTask}
        onMoveTask={onMoveTask}
        onReorderTasks={onReorderTasks}
        onReorderColumns={onReorderColumns}
        onRenameColumn={onRenameColumn}
        onChangeColumnColor={onChangeColumnColor}
        onAddColumn={onAddColumn}
        onDeleteColumn={onDeleteColumn}
      />
      </div>
    </div>
  );
}
