interface TaskPdfField {
  label: string;
  value?: string | number | null;
}

interface TaskPdfListItem {
  title: string;
  detail?: string;
}

interface TaskPdfComment {
  author: string;
  content: string;
  createdAt: string;
}

export interface TaskPdfExportInput {
  taskId: string;
  title: string;
  exportedAt: string;
  summaryFields: TaskPdfField[];
  projectLabels: string[];
  description?: string;
  loadFields: TaskPdfField[];
  dependencies: TaskPdfListItem[];
  attachments: TaskPdfListItem[];
  comments: TaskPdfComment[];
}

export function createTaskPdfFileName(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return `${normalized || 'task'}-details.pdf`;
}

export function buildTaskPdfExportHtml(input: TaskPdfExportInput): string {
  const exportedAt = formatExportDate(input.exportedAt);
  const projectLabels = input.projectLabels.length > 0 ? input.projectLabels.join(', ') : 'No project assigned';
  const description = input.description?.trim() || 'No description provided.';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root {
      color: #18181b;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #ffffff;
      color: #27272a;
      font-size: 12px;
      line-height: 1.45;
    }

    .page {
      width: 100%;
      padding: 28px;
    }

    .header {
      border-bottom: 1px solid #e4e4e7;
      padding-bottom: 18px;
    }

    .eyebrow {
      color: #71717a;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 8px 0 10px;
      color: #18181b;
      font-size: 28px;
      line-height: 1.1;
      overflow-wrap: anywhere;
    }

    .meta {
      color: #71717a;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
    }

    .section {
      break-inside: avoid;
      margin-top: 24px;
    }

    h2 {
      border-bottom: 1px solid #ededf0;
      color: #3f3f46;
      font-size: 12px;
      font-weight: 800;
      margin: 0 0 10px;
      padding-bottom: 7px;
      text-transform: uppercase;
    }

    .grid {
      display: grid;
      column-gap: 28px;
      row-gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .field {
      border-bottom: 1px solid #ededf0;
      padding: 0 0 8px;
    }

    .label {
      color: #71717a;
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    .value {
      color: #27272a;
      font-size: 12px;
      font-weight: 650;
      overflow-wrap: anywhere;
    }

    .description {
      color: #3f3f46;
      overflow-wrap: anywhere;
    }

    .description > *:first-child {
      margin-top: 0;
    }

    .description > *:last-child {
      margin-bottom: 0;
    }

    .description h1,
    .description h2,
    .description h3 {
      border: 0;
      color: #27272a;
      margin: 16px 0 8px;
      padding: 0;
      text-transform: none;
    }

    .description h1 {
      font-size: 18px;
    }

    .description h2 {
      font-size: 15px;
    }

    .description h3 {
      font-size: 13px;
    }

    .description p {
      margin: 0 0 10px;
    }

    .description ul,
    .description ol {
      margin: 0 0 10px;
      padding-left: 18px;
    }

    .description li {
      margin: 3px 0;
    }

    .description .task-list {
      list-style: none;
      padding-left: 0;
    }

    .description .task-list li {
      align-items: flex-start;
      display: flex;
      gap: 8px;
    }

    .checkbox {
      border: 1px solid #a1a1aa;
      border-radius: 3px;
      display: inline-block;
      flex: 0 0 auto;
      height: 11px;
      margin-top: 3px;
      position: relative;
      width: 11px;
    }

    .checkbox.checked::after {
      background: #3f3f46;
      border-radius: 1px;
      content: "";
      height: 5px;
      left: 2px;
      position: absolute;
      top: 2px;
      width: 5px;
    }

    .description code {
      background: #f4f4f5;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      padding: 1px 4px;
    }

    .description pre {
      background: #f4f4f5;
      border-radius: 6px;
      margin: 0 0 10px;
      overflow-wrap: anywhere;
      padding: 10px;
      white-space: pre-wrap;
    }

    .list {
      display: grid;
      gap: 10px;
    }

    .item {
      border-bottom: 1px solid #ededf0;
      padding: 0 0 8px;
    }

    .item-title {
      color: #27272a;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .item-detail {
      color: #71717a;
      margin-top: 3px;
      overflow-wrap: anywhere;
    }

    .empty {
      color: #71717a;
    }

    @page {
      margin: 0;
      size: A4;
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="eyebrow">Task export</div>
      <h1>${escapeHtml(input.title)}</h1>
      <div class="meta">
        <span>ID: ${escapeHtml(input.taskId)}</span>
        <span>Exported: ${escapeHtml(exportedAt)}</span>
        <span>Projects: ${escapeHtml(projectLabels)}</span>
      </div>
    </header>

    ${renderFieldsSection('Summary', input.summaryFields)}
    ${renderMarkdownSection('Description', description)}
    ${renderFieldsSection('Load', input.loadFields)}
    ${renderListSection('Dependencies', input.dependencies, 'No roadmap dependencies.')}
    ${renderListSection('Attachments', input.attachments, 'No attachments.')}
    ${renderCommentsSection(input.comments)}
  </main>
</body>
</html>`;
}

function renderFieldsSection(title: string, fields: TaskPdfField[]): string {
  const visibleFields = fields.filter(field => field.value !== undefined && field.value !== null && `${field.value}`.trim() !== '');
  if (visibleFields.length === 0) return '';

  return `<section class="section">
    <h2>${escapeHtml(title)}</h2>
    <div class="grid">
      ${visibleFields.map(field => `<div class="field">
        <div class="label">${escapeHtml(field.label)}</div>
        <div class="value">${escapeHtml(String(field.value))}</div>
      </div>`).join('')}
    </div>
  </section>`;
}

function renderMarkdownSection(title: string, value: string): string {
  return `<section class="section">
    <h2>${escapeHtml(title)}</h2>
    <div class="description">${renderMarkdown(value)}</div>
  </section>`;
}

function renderMarkdown(value: string): string {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listType: 'ul' | 'ol' | 'task' | null = null;
  let paragraph: string[] = [];
  let codeLines: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType === 'task' ? 'ul' : listType}>`);
    listType = null;
  };

  const openList = (nextType: 'ul' | 'ol' | 'task') => {
    if (listType === nextType) return;
    closeList();
    html.push(nextType === 'task' ? '<ul class="task-list">' : `<${nextType}>`);
    listType = nextType;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith('```')) {
      flushParagraph();
      closeList();
      if (codeLines) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = null;
      } else {
        codeLines = [];
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const taskItem = /^[-*]\s+\[([ xX])\]\s+(.+)$/.exec(line);
    if (taskItem) {
      flushParagraph();
      openList('task');
      const checkedClass = taskItem[1].toLowerCase() === 'x' ? ' checked' : '';
      html.push(`<li><span class="checkbox${checkedClass}"></span><span>${renderInlineMarkdown(taskItem[2])}</span></li>`);
      continue;
    }

    const unorderedItem = /^[-*]\s+(.+)$/.exec(line);
    if (unorderedItem) {
      flushParagraph();
      openList('ul');
      html.push(`<li>${renderInlineMarkdown(unorderedItem[1])}</li>`);
      continue;
    }

    const orderedItem = /^\d+[.)]\s+(.+)$/.exec(line);
    if (orderedItem) {
      flushParagraph();
      openList('ol');
      html.push(`<li>${renderInlineMarkdown(orderedItem[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  if (codeLines) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  closeList();

  return html.join('');
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderListSection(title: string, items: TaskPdfListItem[], emptyMessage: string): string {
  return `<section class="section">
    <h2>${escapeHtml(title)}</h2>
    ${items.length === 0
      ? `<div class="empty">${escapeHtml(emptyMessage)}</div>`
      : `<div class="list">${items.map(item => renderListItem(item)).join('')}</div>`}
  </section>`;
}

function renderCommentsSection(comments: TaskPdfComment[]): string {
  return `<section class="section">
    <h2>Comments</h2>
    ${comments.length === 0
      ? '<div class="empty">No comments.</div>'
      : `<div class="list">${comments.map(comment => renderListItem({
          title: `${comment.author} - ${comment.createdAt}`,
          detail: comment.content,
        })).join('')}</div>`}
  </section>`;
}

function renderListItem(item: TaskPdfListItem): string {
  return `<div class="item">
    <div class="item-title">${escapeHtml(item.title)}</div>
    ${item.detail ? `<div class="item-detail">${escapeHtml(item.detail)}</div>` : ''}
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
