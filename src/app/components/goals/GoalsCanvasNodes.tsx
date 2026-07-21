import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { CircleDot, LoaderCircle, LockKeyhole, RotateCcw } from 'lucide-react';
import type { GoalConditionBranch, GoalConnectorSide, GoalElement, GoalElementReadiness, GoalElementType } from '../../types.ts';
import type { GoalRuntimeNodeStatus } from './GoalsPresentation';

type StatusIcon = (props: { status: GoalElement['status']; className?: string }) => ReactNode;

export interface GoalsCanvasNodesProps {
  elements: GoalElement[];
  selectedElementId?: string;
  connectorMode: boolean;
  connectorSourceId: string | null;
  connectorSourceSide: GoalConnectorSide;
  connectorSourceBranch?: GoalConditionBranch;
  panMode: boolean;
  spaceHeld: boolean;
  canvasElementHeight: (element: GoalElement) => number;
  getElementTitle: (element: GoalElement) => string;
  getElementBody: (element: GoalElement) => string | undefined;
  isConnected: (elementId: string) => boolean;
  isExecutionLocked: (element: GoalElement) => boolean;
  nodeClass: (type: GoalElementType, connected?: boolean) => string;
  elementIcon: (type: GoalElementType) => ReactNode;
  conditionPositiveLabel: (element: GoalElement) => string;
  conditionNegativeLabel: (element: GoalElement) => string;
  readinessForElement: (element: GoalElement, connected: boolean) => GoalElementReadiness;
  readinessLabel: (readiness: GoalElementReadiness) => string;
  readinessChipClass: (readiness: GoalElementReadiness) => string;
  isCompletionElement: (element: GoalElement) => boolean;
  compactChipClass: (colorClass: string) => string;
  statusChipClass: (status: GoalElement['status']) => string;
  statusLabel: (status: GoalElement['status']) => string;
  StatusIcon: StatusIcon;
  runtimeStatusForElement: (element: GoalElement) => GoalRuntimeNodeStatus | undefined;
  onSelectElement: (elementId: string) => void;
  onNodeClick: (element: GoalElement) => void;
  onMoveSelection: (elementId: string, forward: boolean) => void;
  onStartDrag: (element: GoalElement, event: ReactPointerEvent<HTMLDivElement>) => void;
  onConnectNode: (targetId: string, targetSide?: GoalConnectorSide) => void;
  onBeginConnection: (elementId: string, side: GoalConnectorSide, branch?: GoalConditionBranch) => void;
}

function portStyle(side: GoalConnectorSide): CSSProperties {
  if (side === 'top') return { left: '50%', top: '-0.5rem', transform: 'translateX(-50%)' };
  if (side === 'right') return { right: '-0.5rem', top: '50%', transform: 'translateY(-50%)' };
  if (side === 'bottom') return { left: '50%', bottom: '-0.5rem', transform: 'translateX(-50%)' };
  return { left: '-0.5rem', top: '50%', transform: 'translateY(-50%)' };
}

interface CanvasPortsProps {
  element: GoalElement;
  connectorMode: boolean;
  connectorSourceId: string | null;
  connectorSourceSide: GoalConnectorSide;
  connectorSourceBranch?: GoalConditionBranch;
  panMode: boolean;
  spaceHeld: boolean;
  conditionPositiveLabel: (element: GoalElement) => string;
  conditionNegativeLabel: (element: GoalElement) => string;
  onConnectNode: (targetId: string, targetSide?: GoalConnectorSide) => void;
  onBeginConnection: (elementId: string, side: GoalConnectorSide, branch?: GoalConditionBranch) => void;
}

function CanvasPorts({ element, connectorMode, connectorSourceId, connectorSourceSide, connectorSourceBranch, panMode, spaceHeld, conditionPositiveLabel, conditionNegativeLabel, onConnectNode, onBeginConnection }: CanvasPortsProps) {
  const sides = (['top', 'right', 'bottom', 'left'] as GoalConnectorSide[]).filter(side => element.type !== 'condition' || side !== 'right');
  const connectOrBegin = (side: GoalConnectorSide, branch?: GoalConditionBranch) => {
    if (connectorMode && connectorSourceId) onConnectNode(element.id, side);
    else onBeginConnection(element.id, side, branch);
  };
  return <>
    {sides.map(side => <button key={side} type="button" style={portStyle(side)} className={`absolute size-4 rounded-full border-2 border-white shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceSide === side ? 'bg-amber-400' : 'bg-blue-400'}`} onPointerDown={event => { if (!spaceHeld && !panMode) event.stopPropagation(); }} onClick={event => { event.stopPropagation(); connectOrBegin(side); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${element.title} via ${side} handle`} />)}
    {element.type === 'condition' && <>
      <button type="button" style={{ right: '-0.5rem', top: '32%', transform: 'translateY(-50%)' }} className={`absolute size-4 rounded-full border-2 border-white bg-emerald-400 shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceBranch === 'positive' ? 'ring-2 ring-amber-400' : ''}`} onPointerDown={event => { if (!spaceHeld && !panMode) event.stopPropagation(); }} onClick={event => { event.stopPropagation(); connectOrBegin('right', 'positive'); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${conditionPositiveLabel(element)} branch`} />
      <button type="button" style={{ right: '-0.5rem', top: '68%', transform: 'translateY(-50%)' }} className={`absolute size-4 rounded-full border-2 border-white bg-rose-400 shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceBranch === 'negative' ? 'ring-2 ring-amber-400' : ''}`} onPointerDown={event => { if (!spaceHeld && !panMode) event.stopPropagation(); }} onClick={event => { event.stopPropagation(); connectOrBegin('right', 'negative'); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${conditionNegativeLabel(element)} branch`} />
    </>}
  </>;
}

export function GoalsCanvasNodes({ elements, selectedElementId, connectorMode, connectorSourceId, connectorSourceSide, connectorSourceBranch, panMode, spaceHeld, canvasElementHeight, getElementTitle, getElementBody, isConnected, isExecutionLocked, nodeClass, elementIcon, conditionPositiveLabel, conditionNegativeLabel, readinessForElement, readinessLabel, readinessChipClass, isCompletionElement, compactChipClass, statusChipClass, statusLabel, StatusIcon, runtimeStatusForElement, onSelectElement, onNodeClick, onMoveSelection, onStartDrag, onConnectNode, onBeginConnection }: GoalsCanvasNodesProps) {
  return <>{elements.filter(element => element.type !== 'connector').map(element => {
    const connected = isConnected(element.id);
    const locked = isExecutionLocked(element);
    const runtimeStatus = runtimeStatusForElement(element);
    const readiness = readinessForElement(element, connected);
    const readinessDisplay = readiness === 'ready'
      ? <span className="mt-3 inline-flex items-center" title="Ready for workflow use"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-label="Ready" role="img"><title>Ready</title><path d="M8,0C3.6,0,0,3.6,0,8s3.6,8,8,8,8-3.6,8-8S12.4,0,8,0Zm3.707,6.707l-4,4c-.195,.195-.451,.293-.707,.293s-.512-.098-.707-.293l-2-2c-.391-.391-.391-1.023,0-1.414s1.023-1.023,1.414,0l1.293,1.293,3.293-3.293c.391-.391,1.023-.391,1.414,0s.391,1.023,0,1.414Z" fill="#71717A" /></svg></span>
      : <span className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${readinessChipClass(readiness)}`}><CircleDot className="size-3" />{readinessLabel(readiness)}</span>;
    return <div key={element.id} id={`goal-canvas-item-${element.id}`} role="group" aria-label={`${element.type}: ${getElementTitle(element)}`} tabIndex={selectedElementId === element.id ? 0 : -1} onClick={() => onNodeClick(element)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectElement(element.id); } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); onMoveSelection(element.id, event.key === 'ArrowRight' || event.key === 'ArrowDown'); } }} onPointerDown={event => onStartDrag(element, event)} className={`absolute flex flex-col rounded-lg border p-3 text-left shadow-sm transition-shadow hover:shadow-md ${nodeClass(element.type, connected)} ${locked ? 'cursor-not-allowed' : ''} ${selectedElementId === element.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`} style={{ left: element.x, top: element.y, width: element.width ?? 220, height: canvasElementHeight(element) }}>
      <span className="flex min-w-0 items-center gap-2 text-xs font-semibold"><span className="rounded bg-black/5 p-1">{elementIcon(element.type)}</span><span className="truncate">{getElementTitle(element)}</span></span>
      {getElementBody(element) && <span className={`mt-2 line-clamp-2 text-[11px] ${element.type === 'goal' ? 'text-slate-300' : 'text-slate-500'}`}>{getElementBody(element)}</span>}
      {element.type === 'condition' && <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{conditionPositiveLabel(element)}</span><span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-700">{conditionNegativeLabel(element)}</span></div>}
      {element.type === 'retry' && <span className="mt-2 inline-flex w-fit items-center gap-1 text-[10px] font-semibold text-cyan-700"><RotateCcw className="size-3" />Max {element.retryMaxAttempts ?? '—'} attempts</span>}
      {runtimeStatus ? <span className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${compactChipClass(runtimeStatus === 'ready' ? 'border-slate-200 bg-slate-100 text-slate-600' : statusChipClass(runtimeStatus))}`}>{runtimeStatus === 'ready' ? <CircleDot className="size-3" /> : <StatusIcon status={runtimeStatus} />}{runtimeStatus === 'ready' ? 'Ready to execute' : statusLabel(runtimeStatus)}</span> : isCompletionElement(element) ? <span className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${compactChipClass(statusChipClass(element.status))}`}><StatusIcon status={element.status} />{statusLabel(element.status)}</span> : readinessDisplay}
      {locked && <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 shadow-sm" title={element.status === 'working' ? 'In progress — editing locked' : 'Editing locked'}>{element.status === 'working' ? <LoaderCircle aria-hidden="true" className="size-3 animate-spin" /> : <LockKeyhole aria-hidden="true" className="size-3" />}</span>}
      <CanvasPorts element={element} connectorMode={connectorMode} connectorSourceId={connectorSourceId} connectorSourceSide={connectorSourceSide} connectorSourceBranch={connectorSourceBranch} panMode={panMode} spaceHeld={spaceHeld} conditionPositiveLabel={conditionPositiveLabel} conditionNegativeLabel={conditionNegativeLabel} onConnectNode={onConnectNode} onBeginConnection={onBeginConnection} />
    </div>;
  })}</>;
}
