export type RowDropPosition = 'before' | 'after';

export interface RowDropIndicator {
  targetId: string;
  position: RowDropPosition;
}

export function resolveReorderDropIndex(
  ids: string[],
  draggedId: string,
  indicator: RowDropIndicator
): number | null {
  const dragIndex = ids.indexOf(draggedId);
  const targetIndex = ids.indexOf(indicator.targetId);

  if (dragIndex < 0 || targetIndex < 0) {
    return null;
  }

  const rawInsertionIndex = indicator.position === 'before' ? targetIndex : targetIndex + 1;
  const insertionIndex = dragIndex < rawInsertionIndex ? rawInsertionIndex - 1 : rawInsertionIndex;

  return Math.max(0, Math.min(ids.length - 1, insertionIndex));
}

