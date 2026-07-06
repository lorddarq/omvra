import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Edit2, User } from 'lucide-react';
import { TimelineSwimlane } from '../types';
import { getProjectVisual } from '../utils/projectVisual';

export const SWIMLANE_ROW_ITEM_TYPE = 'SWIMLANE_ROW';

export interface SwimlaneRowDragItem {
  type: string;
  index: number;
  swimlane: TimelineSwimlane;
}

export interface SwimlaneRowDropIndicator {
  targetId: string;
  position: 'before' | 'after';
}

interface DraggableSwimlaneLabelProps {
  swimlane: TimelineSwimlane;
  index: number;
  leftColWidth: number;
  rowHeight?: number;
  onEditSwimlane: (swimlane: TimelineSwimlane) => void;
  onSwimlaneDropIndicatorChange: (indicator: SwimlaneRowDropIndicator) => void;
  onSwimlaneDropIndicatorClear: () => void;
  onSwimlaneDrop: (draggedId: string, indicator: SwimlaneRowDropIndicator) => void;
  onSwimlaneDragStart: (draggedId: string) => void;
  onSwimlaneDragEnd: () => void;
  mode?: 'projects' | 'people';
  taskCount?: number;
}

export function DraggableSwimlaneLabel({
  swimlane,
  index,
  leftColWidth,
  rowHeight,
  onEditSwimlane,
  onSwimlaneDropIndicatorChange,
  onSwimlaneDropIndicatorClear,
  onSwimlaneDrop,
  onSwimlaneDragStart,
  onSwimlaneDragEnd,
  mode = 'projects',
  taskCount = 0,
}: DraggableSwimlaneLabelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: SWIMLANE_ROW_ITEM_TYPE,
    item: () => {
      onSwimlaneDropIndicatorClear();
      onSwimlaneDragStart(swimlane.id);
      return { type: SWIMLANE_ROW_ITEM_TYPE, index, swimlane };
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    end: () => {
      onSwimlaneDropIndicatorClear();
      onSwimlaneDragEnd();
    },
  });

  const [, drop] = useDrop({
    accept: SWIMLANE_ROW_ITEM_TYPE,
    hover: (item: SwimlaneRowDragItem, monitor) => {
      if (!ref.current) return;
      if (item.swimlane.id === swimlane.id) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      onSwimlaneDropIndicatorChange({
        targetId: swimlane.id,
        position: hoverClientY > hoverMiddleY ? 'after' : 'before',
      });
    },
    drop: (item: SwimlaneRowDragItem, monitor) => {
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      const fallbackIndicator: SwimlaneRowDropIndicator = {
        targetId: swimlane.id,
        position: hoverBoundingRect && clientOffset && clientOffset.y > hoverBoundingRect.top + hoverBoundingRect.height / 2
          ? 'after'
          : 'before',
      };

      onSwimlaneDrop(item.swimlane.id, fallbackIndicator);
      onSwimlaneDropIndicatorClear();
      onSwimlaneDragEnd();
    },
  });

  preview(drop(ref));
  // attach drag to the handle
  drag(dragHandleRef);

  const projectVisual = getProjectVisual(swimlane);

  return (
    <div
      ref={ref}
      className={`timeline-swimlane-label flex flex-col justify-center px-5 py-3 group transition-[opacity] duration-150 ${
        isDragging ? 'opacity-40' : ''
      }`}
      style={{ 
        width: `${leftColWidth}px`, 
        height: `${rowHeight || 48}px`, 
        boxSizing: 'border-box', 
        minHeight: `${rowHeight || 48}px`,
        ...projectVisual.accentStyle,
      } as CSSProperties}
    >
      <div className="flex items-center justify-between w-full gap-2">
        <div
          ref={dragHandleRef}
          className="timeline-swimlane-drag-handle cursor-move flex-shrink-0"
          aria-label={`Drag ${mode === 'people' ? 'person' : 'project'} row ${swimlane.name}`}
          title={`Drag ${mode === 'people' ? 'person' : 'project'} row`}
        >
          <span className="timeline-drag-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
        
        {mode === 'people' ? (
          <>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="timeline-person-avatar w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-700 truncate">{swimlane.name}</div>
              </div>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
          </>
        ) : (
          <>
            <span className="timeline-project-icon" style={projectVisual.iconStyle} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="min-w-0 flex-1 truncate pr-7 text-sm font-normal text-black">{swimlane.name}</span>
          </>
        )}

        {mode === 'projects' && (
          <button
            type="button"
            className="timeline-row-edit-button h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0 inline-flex items-center justify-center rounded-md"
            onClick={() => onEditSwimlane(swimlane)}
            aria-label={`Edit project ${swimlane.name}`}
            title={`Edit ${swimlane.name}`}
          >
            <Edit2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
