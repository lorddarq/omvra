import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTaskPdfExportHtml, createTaskPdfFileName } from './taskPdfExport.ts';

test('createTaskPdfFileName sanitizes task titles', () => {
  assert.equal(createTaskPdfFileName(' Card / Task: Export? PDF! '), 'card-task-export-pdf-details.pdf');
  assert.equal(createTaskPdfFileName(''), 'task-details.pdf');
});

test('buildTaskPdfExportHtml renders markdown checklist items as printable checkboxes', () => {
  const html = buildTaskPdfExportHtml({
    taskId: 'task-1',
    title: 'Export PDF',
    exportedAt: '2026-06-22T12:00:00.000Z',
    summaryFields: [{ label: 'Status', value: 'Open Tasks' }],
    projectLabels: ['omvra'],
    description: '# Scope\n- [ ] Export rich task\n- [x] Verify sparse task\n\nUse `printToPDF`.',
    loadFields: [],
    dependencies: [],
    attachments: [],
    comments: [],
  });

  assert.match(html, /<h1>Scope<\/h1>/);
  assert.match(html, /<ul class="task-list">/);
  assert.match(html, /<span class="checkbox"><\/span><span>Export rich task<\/span>/);
  assert.match(html, /<span class="checkbox checked"><\/span><span>Verify sparse task<\/span>/);
  assert.match(html, /Use <code>printToPDF<\/code>\./);
});

test('buildTaskPdfExportHtml escapes user-authored content', () => {
  const html = buildTaskPdfExportHtml({
    taskId: 'task-1',
    title: '<script>alert(1)</script>',
    exportedAt: '2026-06-22T12:00:00.000Z',
    summaryFields: [{ label: 'Assignee', value: '<Edgar>' }],
    projectLabels: [],
    description: '<img src=x onerror=alert(1)>',
    loadFields: [],
    dependencies: [],
    attachments: [{ title: 'Notes <draft>', detail: '/tmp/<draft>.md' }],
    comments: [],
  });

  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;Edgar&gt;/);
  assert.match(html, /Notes &lt;draft&gt;/);
});
