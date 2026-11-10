import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPermissionResponse } from './runtimePermissionResponse.ts';

test('mocked Claude-style permission requests produce explicit Allow and Deny payloads', () => {
  const request = { responseKind: 'codex-approval' as const, fields: [] };
  assert.deepEqual(buildPermissionResponse(request, 'accept', {}), { decision: 'accept' });
  assert.deepEqual(buildPermissionResponse(request, 'decline', {}), { decision: 'decline' });
});

test('elicitation permissions preserve selected field values on Allow and clear them on Deny', () => {
  const request = { responseKind: 'elicitation' as const, fields: [{ name: 'approval', defaultValue: 'deny' }] };
  assert.deepEqual(buildPermissionResponse(request, 'accept', { approval: 'allow' }), { action: 'accept', content: { approval: 'allow' }, _meta: null });
  assert.deepEqual(buildPermissionResponse(request, 'decline', { approval: 'allow' }), { action: 'decline', content: null, _meta: null });
});

test('ACP permission responses return the exact user-selected option', () => {
  const request = { responseKind: 'acp-permission' as const, fields: [], options: [
    { optionId: 'allow-once', kind: 'allow_once' },
    { optionId: 'always', kind: 'allow_always' },
    { optionId: 'reject-once', kind: 'reject_once' },
  ] };
  assert.deepEqual(buildPermissionResponse(request, 'accept', {}, 'always'), { outcome: { outcome: 'selected', optionId: 'always' } });
  assert.deepEqual(buildPermissionResponse(request, 'decline', {}, 'reject-once'), { outcome: { outcome: 'selected', optionId: 'reject-once' } });
});
