import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAgentRuntimeWorkspace, resolveConfiguredAgentWorkspace } from './agentRuntimeWorkspace.ts';

test('working-directory resolution keeps project filtering independent', () => {
  assert.deepEqual(resolveConfiguredAgentWorkspace('/task', '/project', '/global'), {
    workspacePath: '/task', source: 'task-override',
  });
  assert.deepEqual(resolveConfiguredAgentWorkspace(undefined, '/project', '/global'), {
    workspacePath: '/project', source: 'project-default',
  });
  assert.deepEqual(resolveConfiguredAgentWorkspace(undefined, undefined, '/global'), {
    workspacePath: '/global', source: 'global-default',
  });
  assert.equal(resolveConfiguredAgentWorkspace(undefined, undefined, undefined), null);
});

test('task execution blocks instead of creating an empty scratch workspace', () => {
  assert.throws(
    () => resolveAgentRuntimeWorkspace(undefined, undefined, undefined),
    /Configure a repository folder on the task or project/,
  );
});

test('execution uses configured folder precedence and ignores blank overrides', () => {
  for (const [task, project, global, workspacePath, source] of [
    [' /task ', '/project', '/global', '/task', 'task-override'],
    ['  ', ' /project ', '/global', '/project', 'project-default'],
    [undefined, '  ', ' /global ', '/global', 'global-default'],
  ]) {
    assert.deepEqual(resolveAgentRuntimeWorkspace(task, project, global), { workspacePath, source });
  }
  assert.throws(() => resolveAgentRuntimeWorkspace(' ', ' ', ' '), /Configure a repository folder/);
});
