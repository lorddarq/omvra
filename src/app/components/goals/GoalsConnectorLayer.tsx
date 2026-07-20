import type { GoalElement } from '../../types.ts';

export interface GoalsConnectorLayerProps {
  connections: GoalElement[];
  elements: GoalElement[];
  selectedElementId?: string;
  connectorPath: (connection: GoalElement) => string | null;
  onSelectConnector: (connectionId: string) => void;
  onMoveSelection: (elementId: string, forward: boolean) => void;
}

export function GoalsConnectorLayer({ connections, elements, selectedElementId, connectorPath, onSelectConnector, onMoveSelection }: GoalsConnectorLayerProps) {
  return <svg className="pointer-events-auto absolute left-0 top-0 h-[1200px] w-[2000px] overflow-visible">
    <defs>{connections.map(connection => <linearGradient key={connection.id} id={`connector-gradient-${connection.id}`} x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stopColor={connection.conditionBranch === 'positive' ? '#34d399' : '#fb7185'} /><stop offset="100%" stopColor="#60a5fa" /></linearGradient>)}</defs>
    {connections.map(connection => {
      const path = connectorPath(connection);
      const branchLabel = connection.conditionBranch ? ` via ${connection.conditionBranch} branch` : '';
      const source = elements.find(element => element.id === connection.sourceId);
      const isRetryReturn = source?.type === 'retry';
      return path ? <path key={connection.id} id={`goal-canvas-item-${connection.id}`} d={path} fill="none" stroke={connection.conditionBranch ? `url(#connector-gradient-${connection.id})` : isRetryReturn ? '#0891b2' : selectedElementId === connection.id ? '#2563eb' : '#94a3b8'} strokeWidth={selectedElementId === connection.id ? '3' : '2'} strokeDasharray={isRetryReturn ? '7 5' : undefined} strokeLinecap="round" className="cursor-pointer outline-none focus-visible:stroke-blue-600" onClick={event => { event.stopPropagation(); onSelectConnector(connection.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectConnector(connection.id); } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); onMoveSelection(connection.id, event.key === 'ArrowRight' || event.key === 'ArrowDown'); } }} role="button" tabIndex={selectedElementId === connection.id ? 0 : -1} aria-label={`${isRetryReturn ? 'Retry return' : 'Connector'} from ${connection.sourceId} to ${connection.targetId}${branchLabel}`} /> : null;
    })}
  </svg>;
}
