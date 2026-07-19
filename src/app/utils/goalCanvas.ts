import type { GoalElement } from '../types.ts';

export function isGoalElementConnected(elements: GoalElement[], elementId: string): boolean {
  return elements.some(element => element.type === 'connector' && (element.sourceId === elementId || element.targetId === elementId));
}

export function isValidRetryTarget(elements: GoalElement[], retryId: string, targetId: string, ignoredConnectorId?: string | null): boolean {
  const incoming = new Map<string, string[]>();
  elements.filter(element => element.type === 'connector' && element.id !== ignoredConnectorId && element.sourceId && element.targetId).forEach(connection => {
    const source = elements.find(element => element.id === connection.sourceId);
    if (source?.type === 'retry') return;
    const parents = incoming.get(connection.targetId!) ?? [];
    parents.push(connection.sourceId!);
    incoming.set(connection.targetId!, parents);
  });

  const pending = [retryId];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === targetId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(incoming.get(current) ?? []));
  }
  return false;
}

export function wouldCreateGoalCycle(elements: GoalElement[], sourceId: string, targetId: string, ignoredConnectorId?: string | null): boolean {
  if (sourceId === targetId) return true;

  const next = new Map<string, string[]>();
  elements.filter(element => element.type === 'connector' && element.id !== ignoredConnectorId && element.sourceId && element.targetId).forEach(connection => {
    const source = elements.find(element => element.id === connection.sourceId);
    if (source?.type === 'retry') return;
    const targets = next.get(connection.sourceId!) ?? [];
    targets.push(connection.targetId!);
    next.set(connection.sourceId!, targets);
  });

  const pending = [targetId];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(next.get(current) ?? []));
  }
  return false;
}
