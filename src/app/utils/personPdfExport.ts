import type { Person, Task } from '../types.ts';
import { buildPdfDocument, createPdfFileName, type PdfField, type PdfListItem, renderFieldsSection, renderListSection, renderNotesSection } from './pdfExport.ts';

export interface PersonPdfExportInput {
  person: Person;
  exportedAt: string;
  projectLabels: string[];
  summaryFields: PdfField[];
  assignedTasks: PdfListItem[];
}

export function createPersonPdfFileName(name: string): string {
  return createPdfFileName(name, 'person');
}

export function buildPersonPdfExportHtml(input: PersonPdfExportInput): string {
  return buildPdfDocument({
    eyebrow: input.person.kind === 'agentic' ? 'Agent export' : 'Person export',
    title: input.person.name,
    entityLabel: 'ID',
    entityId: input.person.id,
    exportedAt: input.exportedAt,
    projectLabels: input.projectLabels,
    sections: [
      { title: 'Summary', body: renderFieldsSection(input.summaryFields) },
      ...(input.person.kind === 'agentic' && input.person.agentInstructions?.trim()
        ? [{ title: 'Agent behaviour', body: renderNotesSection(input.person.agentInstructions.trim()) }]
        : []),
      ...(input.person.kind === 'agentic' && input.person.agentOperationalInstructions?.trim()
        ? [{ title: 'Operational instructions', body: renderNotesSection(input.person.agentOperationalInstructions.trim()) }]
        : []),
      { title: 'Assigned Tasks', body: renderListSection(input.assignedTasks, 'No tasks currently assigned.') },
    ],
  });
}

export function buildPersonTaskExportListItem(task: Task, options: {
  statusLabel: string;
  projectLabels: string[];
}): PdfListItem {
  const detailParts = [
    options.projectLabels.length > 0 ? `Projects: ${options.projectLabels.join(', ')}` : null,
    task.priority ? `Priority: ${task.priority}` : null,
    task.size ? `Size: ${task.size.toUpperCase()}` : null,
    task.complexity ? `Complexity: ${task.complexity}` : null,
    task.startDate || task.endDate ? `Dates: ${task.startDate || 'No start'} to ${task.endDate || 'No end'}` : null,
    task.blocked ? 'Blocked: Yes' : null,
    task.notes?.trim() ? `Notes: ${task.notes.trim().replace(/\s+/g, ' ').slice(0, 180)}${task.notes.trim().length > 180 ? '...' : ''}` : null,
  ].filter(Boolean);

  return {
    title: task.title,
    detail: detailParts.join(' | '),
    badge: options.statusLabel,
  };
}
