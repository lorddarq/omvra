interface TaskPdfComment {
  author: string;
  content: string;
  createdAt: string;
}

export interface TaskPdfExportInput {
  taskId: string;
  title: string;
  exportedAt: string;
  summaryFields: import('./pdfExport').PdfField[];
  projectLabels: string[];
  description?: string;
  loadFields: import('./pdfExport').PdfField[];
  dependencies: import('./pdfExport').PdfListItem[];
  attachments: import('./pdfExport').PdfListItem[];
  comments: TaskPdfComment[];
}

import { buildPdfDocument, createPdfFileName, renderFieldsSection, renderListSection, renderMarkdownSection } from './pdfExport.ts';

export function createTaskPdfFileName(title: string): string {
  return createPdfFileName(title, 'task');
}

export function buildTaskPdfExportHtml(input: TaskPdfExportInput): string {
  const description = input.description?.trim() || 'No description provided.';

  return buildPdfDocument({
    eyebrow: 'Task export',
    title: input.title,
    entityLabel: 'ID',
    entityId: input.taskId,
    exportedAt: input.exportedAt,
    projectLabels: input.projectLabels,
    sections: [
      { title: 'Summary', body: renderFieldsSection(input.summaryFields) },
      { title: 'Description', body: renderMarkdownSection(description) },
      { title: 'Load', body: renderFieldsSection(input.loadFields) },
      { title: 'Dependencies', body: renderListSection(input.dependencies, 'No roadmap dependencies.') },
      { title: 'Attachments', body: renderListSection(input.attachments, 'No attachments.') },
      { title: 'Comments', body: renderCommentsSection(input.comments) },
    ],
  });
}

function renderCommentsSection(comments: TaskPdfComment[]): string {
  return renderListSection(
    comments.map(comment => ({
      title: `${comment.author} - ${comment.createdAt}`,
      detail: comment.content,
    })),
    'No comments.'
  );
}
