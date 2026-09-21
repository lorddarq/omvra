import assert from 'node:assert/strict';
import test from 'node:test';
import { getLatestTaskAgentOutput, getTaskExecutionPresentation, taskNeedsProviderSignIn } from './taskExecutionPresentation.ts';

test('connection and work state stay independent and prior output survives a new turn', () => {
  const base = { taskStatus: 'in-progress', loading: false, authenticationRequired: false, blocked: false, mcpUnavailable: false, waitingForPermission: false };
  assert.deepEqual(getTaskExecutionPresentation({ ...base, binding: { state: 'ready', turn: { state: 'active' } } }), { connection: 'Connected', status: 'Working' });
  assert.deepEqual(getTaskExecutionPresentation({ ...base, binding: { state: 'ready', turn: { state: 'waiting-input' } }, waitingForPermission: true }), { connection: 'Connected', status: 'Waiting for approval' });
  assert.equal(getTaskExecutionPresentation({ ...base, authenticationRequired: true }).connection, 'Unauthorized');
  assert.equal(getTaskExecutionPresentation({ ...base, binding: { state: 'closed' } }).connection, 'Disconnected');
  assert.equal(getTaskExecutionPresentation({ ...base, taskStatus: 'done', binding: { state: 'ready' } }).status, 'Ended');
  assert.equal(getLatestTaskAgentOutput([
    { id: '1', type: 'native', turnId: 'a', nativeEventType: 'turn/started' },
    { id: '2', type: 'native', turnId: 'a', nativeEventType: 'item/agentMessage/delta', messagePreview: 'Last response.' },
    { id: '3', type: 'native', turnId: 'b', nativeEventType: 'turn/started' },
  ]), 'Last response.');
});

test('expired provider credentials surface sign-in only on a failed or interrupted run', () => {
  assert.equal(taskNeedsProviderSignIn({ state: 'interrupted' }, undefined, 'Failed to authenticate: OAuth session expired and could not be refreshed'), true);
  assert.equal(taskNeedsProviderSignIn({ state: 'active' }, undefined, 'Authentication required in the feature we are building'), false);
});

 test('latest response excludes commentary before the last item boundary', () => {
  assert.equal(getLatestTaskAgentOutput([
    { id: '1', type: 'native', nativeEventType: 'turn/started' },
    { id: '2', type: 'native', nativeEventType: 'item/agentMessage/delta', messagePreview: 'Checking files.' },
    { id: '3', type: 'native', nativeEventType: 'item/completed', toolName: 'commandExecution' },
    { id: '4', type: 'native', nativeEventType: 'item/agentMessage/delta', messagePreview: 'All checks ' },
    { id: '5', type: 'native', nativeEventType: 'item/agentMessage/delta', messagePreview: 'passed.' },
  ]), 'All checks passed.');
});
