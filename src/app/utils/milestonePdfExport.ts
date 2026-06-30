import { buildPdfDocument, createPdfFileName, renderFieldsSection, renderListSection, renderNotesSection } from './pdfExport.ts';

export interface MilestonePdfExportInput {
  milestoneId: string;
  title: string;
  exportedAt: string;
  projectLabels: string[];
  summaryFields: import('./pdfExport').PdfField[];
  notes?: string;
  linkedTasks: import('./pdfExport').PdfListItem[];
}

export function createMilestonePdfFileName(title: string): string {
  return createPdfFileName(title, 'milestone');
}

export function buildMilestonePdfExportHtml(input: MilestonePdfExportInput): string {
  const notes = input.notes?.trim() || 'No notes provided.';
  return buildPdfDocument({
    eyebrow: 'Milestone export',
    title: input.title,
    entityLabel: 'ID',
    entityId: input.milestoneId,
    exportedAt: input.exportedAt,
    projectLabels: input.projectLabels,
    sections: [
      { title: 'Summary', body: renderFieldsSection(input.summaryFields) },
      { title: 'Notes', body: renderNotesSection(notes) },
      { title: 'Linked Tasks', body: renderListSection(input.linkedTasks, 'No linked tasks.') },
    ],
  });
}
