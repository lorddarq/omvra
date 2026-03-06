import { useRef } from 'react';
import { useDrag } from 'react-dnd';
import { Task } from '../types';

const TIMELINE_TASK_TYPE = 'TIMELINE_TASK';
const PRIORITY_STYLES: Record<string, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-red-500/90 text-white' },
  moderate: { label: 'Moderate', className: 'bg-orange-500/90 text-white' },
  normal: { label: 'Normal', className: 'bg-blue-500/90 text-white' },
  low: { label: 'Low', className: 'bg-green-500/90 text-white' },
};

interface DraggableTimelineTaskProps {
  task: Task;
  position: { left: number; width: number };
  getTaskColor: (status: string) => { className?: string; style?: React.CSSProperties; textClass?: string };
  handleResizeStart: (e: React.MouseEvent, task: Task, edge: 'start' | 'end') => void;
  onTaskClick: (task: Task) => void;
  resizingTaskId: string | null;
}

export function DraggableTimelineTask({
  task,
  position,
  getTaskColor,
  handleResizeStart,
  onTaskClick,
  resizingTaskId,
}: DraggableTimelineTaskProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const [{ isDragging }, drag] = useDrag({
    type: TIMELINE_TASK_TYPE,
    item: { type: TIMELINE_TASK_TYPE, task },
    canDrag: () => !resizingTaskId, // disable dragging while any task is being resized
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(ref);

  const color = getTaskColor(task.status);
  const textClass = color.className ?? color.textClass ?? 'text-white';

  function handleMouseDown(e: React.MouseEvent) {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!mouseDownPos.current) return;
    
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    
    // If mouse didn't move much (< 5px), treat it as a click
    if (dx < 5 && dy < 5) {
      onTaskClick(task);
    }
    
    mouseDownPos.current = null;
  }

  return (
    <div
      ref={ref}
      className={`absolute h-8 rounded-md px-3 flex items-center gap-2 shadow-sm cursor-pointer pointer-events-auto group/task ${textClass} text-xs transition-all ${
        resizingTaskId === task.id ? 'shadow-lg z-10' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{
        left: `${position.left + 4}px`,
        width: `${position.width}px`,
        ...(color.style || {}),
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 flex items-center justify-center opacity-0 group-hover/task:opacity-100"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleResizeStart(e, task, 'start');
        }}
      >
        <div className="w-0.5 h-4 bg-white/50 rounded"></div>
      </div>

      <span
        className={`shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] font-medium leading-none ${
          PRIORITY_STYLES[task.priority || 'normal']?.className || PRIORITY_STYLES.normal.className
        }`}
      >
        {PRIORITY_STYLES[task.priority || 'normal']?.label || PRIORITY_STYLES.normal.label}
      </span>
      <span className="truncate flex-1 text-left">{task.title}</span>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 flex items-center justify-center opacity-0 group-hover/task:opacity-100"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleResizeStart(e, task, 'end');
        }}
      >
        <div className="w-0.5 h-4 bg-white/50 rounded"></div>
      </div>
    </div>
  );
}

export { TIMELINE_TASK_TYPE };
