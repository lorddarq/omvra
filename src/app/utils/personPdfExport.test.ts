import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonPdfExportHtml, createPersonPdfFileName } from './personPdfExport.ts';

test('createPersonPdfFileName sanitizes person names', () => {
  assert.equal(createPersonPdfFileName(' Ted / Export? '), 'ted-export-details.pdf');
  assert.equal(createPersonPdfFileName(''), 'person-details.pdf');
});

test('buildPersonPdfExportHtml renders empty assigned-task state', () => {
  const html = buildPersonPdfExportHtml({
    person: {
      id: 'person-1',
      name: 'Ted',
      role: 'Designer',
      kind: 'human',
    },
    exportedAt: '2026-06-30T12:00:00.000Z',
    projectLabels: ['omvra'],
    summaryFields: [
      { label: 'Assigned Tasks', value: 0 },
    ],
    assignedTasks: [],
  });

  assert.match(html, /Person export/);
  assert.match(html, /No tasks currently assigned\./);
  assert.match(html, /Ted/);
});

test('buildPersonPdfExportHtml includes agent behaviour, operational instructions, and task metadata', () => {
  const html = buildPersonPdfExportHtml({
    person: {
      id: 'agent-1',
      name: 'Pericles',
      role: 'Agent',
      kind: 'agentic',
      agentInstructions: 'Review roadmap tasks carefully.',
      agentOperationalInstructions: 'Start by reading the task and checking linked roadmap items.',
    },
    exportedAt: '2026-06-30T12:00:00.000Z',
    projectLabels: ['omvra'],
    summaryFields: [
      { label: 'Assigned Tasks', value: 1 },
    ],
    assignedTasks: [
      {
        title: 'Refine roadmap export',
        detail: 'Projects: omvra | Priority: normal',
        badge: 'In Progress',
      },
    ],
  });

  assert.match(html, /Agent behaviour/);
  assert.match(html, /Review roadmap tasks carefully\./);
  assert.match(html, /Operational instructions/);
  assert.match(html, /Start by reading the task and checking linked roadmap items\./);
  assert.match(html, /Refine roadmap export/);
  assert.match(html, /In Progress/);
});
