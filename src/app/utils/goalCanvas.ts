import type { GoalElement } from '../types.ts';

export function isGoalElementConnected(elements: GoalElement[], elementId: string): boolean {
  return elements.some(element => element.type === 'connector' && (element.sourceId === elementId || element.targetId === elementId));
}

export function wouldCreateGoalCycle(elements: GoalElement[], sourceId: string, targetId: string, ignoredConnectorId?: string | null): boolean {
  if (sourceId === targetId) return true;

  const next = new Map<string, string[]>();
  elements.filter(element => element.type === 'connector' && element.id !== ignoredConnectorId && element.sourceId && element.targetId).forEach(connection => {
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
