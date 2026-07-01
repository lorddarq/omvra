import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectMilestone, Task } from '../types.ts';
import {
  getMilestoneHealthVisual,
  getStatusVisual,
  resolveStatusColor,
  summarizeMilestone,
  wouldCreateDependencyCycle,
} from './roadmap.ts';

const statusColumns = [
  { id: 'open', title: 'Open', color: '#d1d5db' },
  { id: 'in-progress', title: 'Doing', color: '#3b82f6' },
  { id: 'under-review', title: 'Review', color: 'bg-amber-500' },
  { id: 'done', title: 'Done', color: '#10b981' },
] as const;

test('getStatusVisual derives label, color, and progress from shared status columns', () => {
  const visual = getStatusVisual(statusColumns as any, 'under-review');

  assert.equal(visual.label, 'Review');
  assert.equal(visual.color, '#f59e0b');
  assert.equal(visual.backgroundClassName, 'bg-amber-500');
  assert.equal(visual.progressPercent, 80);
});

test('summarizeMilestone and getMilestoneHealthVisual share milestone health semantics', () => {
  const milestone: ProjectMilestone = {
    id: 'milestone-1',
    title: 'Architecture',
    projectIds: ['project-1'],
    endDate: '2026-07-10',
    linkedTaskIds: ['task-1', 'task-2'],
  };
  const tasks: Task[] = [
    { id: 'task-1', title: 'Shared status layer', status: 'done', endDate: '2026-07-09' },
    { id: 'task-2', title: 'Roadmap rewiring', status: 'in-progress', endDate: '2026-07-08' },
  ];

  const summary = summarizeMilestone(milestone, tasks);
  const health = getMilestoneHealthVisual(summary.health);

  assert.equal(summary.health, 'in-progress');
  assert.equal(summary.completionPercent, 50);
  assert.equal(health.label, 'In progress');
  assert.match(health.className, /blue/);
});

test('wouldCreateDependencyCycle catches loops across linked tasks', () => {
  const dependenciesByTaskId: Record<string, string[]> = {
    'task-1': ['task-2'],
    'task-2': ['task-3'],
    'task-3': [],
  };

  assert.equal(
    wouldCreateDependencyCycle('task-3', 'task-1', taskId => dependenciesByTaskId[taskId]),
    true
  );
  assert.equal(
    wouldCreateDependencyCycle('task-1', 'task-3', taskId => dependenciesByTaskId[taskId]),
    false
  );
});

test('resolveStatusColor normalizes tailwind-style status colors for shared pills', () => {
  assert.equal(resolveStatusColor('under-review', 'bg-amber-500'), '#f59e0b');
  assert.equal(resolveStatusColor('bug', undefined), '#da0004');
});
