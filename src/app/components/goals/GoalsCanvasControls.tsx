import { Minus, ZoomIn } from 'lucide-react';

type GoalsCanvasControlsProps = {
  spacePressed: boolean;
  panMode: boolean;
  zoom: number;
  onTogglePanMode: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
};

export function GoalsCanvasControls({ spacePressed, panMode, zoom, onTogglePanMode, onZoomOut, onZoomIn }: GoalsCanvasControlsProps) {
  return <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
    {(spacePressed || panMode) && <div className="pointer-events-none rounded bg-slate-900/80 px-2 py-1 text-xs text-white shadow-sm">{spacePressed ? 'Release space to edit' : 'Pan mode · drag to move'}</div>}
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-2 text-xs text-slate-500 shadow-sm">
      <button type="button" onClick={onTogglePanMode} className={`size-8 rounded-full p-2 text-xs ${panMode ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`} aria-pressed={panMode} aria-label="Pan canvas">Pan</button>
      <div className="flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
        <button type="button" className="rounded-full p-1 hover:bg-slate-100" onClick={onZoomOut} aria-label="Zoom out"><Minus className="size-3" /></button>
        <span className="min-w-9 text-center font-medium tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
        <button type="button" className="rounded-full p-1 hover:bg-slate-100" onClick={onZoomIn} aria-label="Zoom in"><ZoomIn className="size-3" /></button>
      </div>
    </div>
  </div>;
}
