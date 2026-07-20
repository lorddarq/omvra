import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';

export function GoalsCanvasSurface({ canvasRef, spacePressed, panMode, pan, zoom, emptyState, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, children }: { canvasRef: RefObject<HTMLDivElement | null>; spacePressed: boolean; panMode: boolean; pan: { x: number; y: number }; zoom: number; emptyState?: ReactNode; onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void; onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void; children: ReactNode }) {
  return <div ref={canvasRef} tabIndex={0} role="application" aria-label="Goal canvas. Hold space and drag to pan." className={`h-full w-full outline-none ${spacePressed || panMode ? 'cursor-grab' : 'cursor-default'}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onLostPointerCapture={onLostPointerCapture}>
    <div className="goals-canvas-grid absolute inset-0" aria-hidden="true" />
    {emptyState}
    <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`, transformOrigin: 'center' }}>{children}</div>
  </div>;
}
