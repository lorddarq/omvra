export interface ChecklistPreviewItem {
  text: string;
  checked: boolean;
}

export interface TaskCardContentPreview {
  bodyPreview: string;
  checklistItems: ChecklistPreviewItem[];
}

export function normalizeTaskNotesForSave(notes: string): string {
  return notes.trim().length === 0 ? '' : notes;
}

export function extractTaskCardContent(notes?: string): TaskCardContentPreview {
  if (!notes?.trim()) {
    return { bodyPreview: '', checklistItems: [] };
  }

  const checklistItems: ChecklistPreviewItem[] = [];
  const bodyChunks: string[] = [];
  const checklistRegex = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/;

  notes.split(/\r?\n/).forEach(line => {
    const match = line.match(checklistRegex);
    if (match) {
      const text = match[2].trim();
      if (text) {
        checklistItems.push({ text, checked: match[1].toLowerCase() === 'x' });
      }
      return;
    }

    const normalized = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .trim();

    if (normalized && !/^\|(?:\s*[-:]+[-| :]*)$/.test(normalized) && !normalized.startsWith('|')) {
      bodyChunks.push(normalized);
    }
  });

  return {
    bodyPreview: bodyChunks.join(' ').replace(/\s+/g, ' ').trim(),
    checklistItems,
  };
}
