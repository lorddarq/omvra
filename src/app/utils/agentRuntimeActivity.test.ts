import assert from 'node:assert/strict';
import test from 'node:test';
import { agentRuntimeTurnState, describeAgentRuntimeSession, hasAgentRuntimeTaskStarted, isAgentRuntimeTurnInFlight, joinAgentMessageDeltas, projectAgentRuntimeSession, projectDeliveryActivity, resolveAgentTaskAttention, selectCurrentAgentRuntimeTurnEvents, summarizeAgentRuntimeActivity } from './agentRuntimeActivity.ts';

test('agent message delta joining preserves normal boundaries and repairs compact legacy chunks', () => {
  assert.equal(joinAgentMessageDeltas(['Current ', 'implementation ', 'passes.']), 'Current implementation passes.');
  assert.equal(joinAgentMessageDeltas(['Current', 'implementation', 'passes', '.']), 'Current implementation passes.');
});

test('runtime activity collapses noisy tool updates and preserves agent run milestones', () => {
  const events = [
    { id: '1', type: 'session-state', nativeEventType: 'thread/started', observedAt: '2026-08-02T12:00:00.000Z' },
    { id: '2', type: 'session-state', nativeEventType: 'mcpServer/startupStatus/updated', state: 'starting', observedAt: '2026-08-02T12:00:01.000Z' },
    { id: '3', type: 'session-state', nativeEventType: 'mcpServer/startupStatus/updated', state: 'starting', observedAt: '2026-08-02T12:00:02.000Z' },
    { id: '4', type: 'turn-state', nativeEventType: 'turn/started', observedAt: '2026-08-02T12:00:03.000Z' },
    { id: '5', type: 'turn-state', nativeEventType: 'turn/completed', observedAt: '2026-08-02T12:00:04.000Z' },
  ];
  const activity = summarizeAgentRuntimeActivity(events);
  assert.equal(activity.find(item => item.label === 'Tool connection starting')?.count, 2);
  assert.equal(activity.some(item => item.label === 'Task instructions accepted'), true);
  assert.equal(activity.some(item => item.label === 'Agent finished the latest run'), true);
  assert.equal(describeAgentRuntimeSession('ready', events).label, 'Batch finished');
  assert.equal(describeAgentRuntimeSession('ready', events).isTurnActive, false);
});

test('runtime session summary trusts active binding state when the bounded event window is stale', () => {
  const working = describeAgentRuntimeSession('active', [
    { id: '1', type: 'turn-state', nativeEventType: 'turn/completed', observedAt: '2026-08-02T12:00:00.000Z' },
  ]);
  assert.equal(working.label, 'Agent is working');
  assert.equal(working.isTurnActive, true);
});

test('runtime session summary distinguishes connected idle and stopping states', () => {
  const idle = describeAgentRuntimeSession('ready', []);
  assert.equal(idle.label, 'Session connected, no run active');
  assert.match(idle.detail, /continue work/i);

  const stopping = describeAgentRuntimeSession('cancelling', []);
  assert.equal(stopping.label, 'Agent is stopping');
  assert.equal(stopping.isTurnActive, false);
});

test('a ready provider session reports work only from its canonical turn projection', () => {
  const idle = { state: 'ready', turn: { id: 'turn-1', state: 'completed' } };
  const working = { state: 'ready', turn: { id: 'turn-2', state: 'active' } };
  assert.equal(isAgentRuntimeTurnInFlight(idle), false);
  assert.equal(isAgentRuntimeTurnInFlight(working), true);
  assert.equal(agentRuntimeTurnState(working), 'active');
  assert.equal(describeAgentRuntimeSession('ready', [], undefined, agentRuntimeTurnState(working)).label, 'Agent is working');
});

test('an active turn proves task instructions were accepted before events arrive', () => {
  assert.equal(hasAgentRuntimeTaskStarted('active', []), true);
  assert.equal(hasAgentRuntimeTaskStarted('starting', []), false);
  assert.equal(hasAgentRuntimeTaskStarted(undefined, [{ id: 'event-1', type: 'turn-state', nativeEventType: 'turn/started' }]), true);
});

test('current turn activity remains visible after its start event leaves the bounded window', () => {
  const events = [
    { id: 'event-0', type: 'turn-state', turnId: 'turn-previous', nativeEventType: 'turn/started' },
    { id: 'event-1', type: 'session-state', turnId: 'turn-current', nativeEventType: 'item/started', toolName: 'reasoning' },
    { id: 'event-2', type: 'session-state', turnId: 'turn-current', nativeEventType: 'item/agentMessage/delta', messagePreview: 'Still working.' },
  ];
  assert.deepEqual(selectCurrentAgentRuntimeTurnEvents(events, 'turn-current'), events.slice(1));
  assert.deepEqual(selectCurrentAgentRuntimeTurnEvents(events, 'turn-other'), []);
});

test('terminal provider sessions ignore stale in-flight turn projections', () => {
  for (const state of ['interrupted', 'closed', 'failed']) {
    const binding = { state, turn: { id: 'stale-turn', state: 'waiting-input' } };
    assert.equal(agentRuntimeTurnState(binding), undefined);
    assert.equal(isAgentRuntimeTurnInFlight(binding), false);
  }
});

test('runtime activity identifies tool connections when the provider reports their names', () => {
  const activity = summarizeAgentRuntimeActivity([
    { id: '1', type: 'session-state', nativeEventType: 'mcpServer/startupStatus/updated', state: 'failed', outcome: 'reauthenticationRequired', toolName: 'figma', observedAt: '2026-08-02T12:00:00.000Z' },
  ]);
  assert.equal(activity[0].label, 'Tool connection failed: figma');
  assert.equal(activity[0].detail, 'Authentication is required before this connection can start.');
});

test('runtime activity exposes bounded reasoning progress and actionable errors', () => {
  const activity = summarizeAgentRuntimeActivity([
    { id: '1', type: 'tool-state', nativeEventType: 'item/started', toolName: 'reasoning' },
    { id: '2', type: 'session-state', nativeEventType: 'error', outcome: 'Task tool failed.' },
  ]);
  assert.equal(activity[0].label, 'Thinking through the task');
  assert.equal(activity[1].label, 'Agent encountered an error');
  assert.equal(activity[1].detail, 'Task tool failed.');
});

test('runtime activity distinguishes interrupted and failed turn outcomes', () => {
  const activity = summarizeAgentRuntimeActivity([
    { id: '1', type: 'turn-state', nativeEventType: 'turn/completed', state: 'interrupted' },
    { id: '2', type: 'turn-state', nativeEventType: 'turn/completed', state: 'failed', outcome: 'Command failed.' },
  ]);
  assert.equal(activity[0].label, 'Agent work was interrupted');
  assert.equal(activity[1].label, 'Agent run failed');
  assert.equal(activity[1].detail, 'Command failed.');
});

test('closed sessions and finished batches explain that more work may remain', () => {
  assert.equal(describeAgentRuntimeSession('closed', []).label, 'No agent is working');
  assert.match(describeAgentRuntimeSession('closed', []).detail, /closed session/i);
  assert.equal(describeAgentRuntimeSession('ready', [{ id: '1', type: 'turn-state', nativeEventType: 'turn/completed' }]).label, 'Batch finished');
});

test('one session projection drives both supervision summaries and dock states', () => {
  const working = projectAgentRuntimeSession({ state: 'ready', turn: { id: 'turn-1', state: 'active' } });
  assert.equal(working.turnState, 'active');
  assert.equal(working.summary?.label, 'Agent is working');
  assert.equal(working.dockState, 'hidden-active');
  assert.equal(projectAgentRuntimeSession(
    { state: 'ready', turn: { id: 'turn-1', state: 'active' } },
    [],
    { supervisionVisible: true },
  ).dockState, 'working');

  const waiting = projectAgentRuntimeSession({ state: 'ready', turn: { id: 'turn-2', state: 'waiting-input' } });
  assert.equal(waiting.summary?.label, 'Agent is waiting for you');
  assert.equal(waiting.dockState, 'needs-input');
  assert.equal(projectAgentRuntimeSession(undefined, [], { blocked: true }).dockState, 'blocked');
});

test('Agent tasks attention covers working, blocked, permission, input, failed, cancelled and completed', () => {
  const kind = (input: Parameters<typeof resolveAgentTaskAttention>[0]) => resolveAgentTaskAttention(input)?.kind;
  const ready = { state: 'ready' };
  assert.equal(kind({ binding: { state: 'ready', turn: { id: 't', state: 'active' } }, taskStatus: 'in-progress' }), 'active');
  assert.equal(kind({ blockedReason: 'Another task is using the agent.' }), 'blocked');
  assert.equal(resolveAgentTaskAttention({ blockedReason: 'History not saved.' })?.description, 'History not saved.');
  assert.equal(kind({ binding: ready, deliveryAttention: { category: 'blocked' } }), 'blocked');

  const waiting = { state: 'ready', turn: { id: 't', state: 'waiting-input' } };
  const permission = resolveAgentTaskAttention({ binding: waiting, pendingRequest: { requestId: 1, message: 'Allow npm test?', kind: 'permission' } });
  assert.equal(permission?.kind, 'permission-required');
  assert.equal(permission?.description, 'Allow npm test?');
  assert.equal(kind({ binding: waiting, pendingRequest: { requestId: 1, message: 'Which file?', kind: 'input' } }), 'needs-input');
  assert.equal(kind({ binding: ready, deliveryAttention: { category: 'permission' } }), 'permission-required', 'projection attention is immediate, before the binding update lands');
  assert.equal(kind({ binding: ready, deliveryAttention: { category: 'input' } }), 'needs-input');
  assert.equal(resolveAgentTaskAttention({ binding: waiting })?.label, 'Input request unavailable');

  assert.equal(kind({ binding: { state: 'failed' } }), 'failed');
  assert.equal(kind({ binding: ready, deliveryAttention: { category: 'failure' } }), 'failed');
  assert.equal(kind({ binding: { state: 'ready', turn: { id: 't', state: 'interrupted', terminalReason: 'cancelled' } } }), 'cancelled');
  assert.equal(kind({ binding: ready, deliveryAttention: { category: 'cancelled' } }), 'cancelled');
  assert.equal(kind({ binding: { state: 'ready', turn: { id: 't', state: 'interrupted', terminalReason: 'process-exit' } } }), 'interrupted', 'a crash is not a user stop');
  assert.equal(kind({ binding: ready, deliveryAttention: { category: 'recovery' } }), 'interrupted');
  assert.equal(kind({ binding: { state: 'ready', turn: { id: 't', state: 'completed' } } }), 'batch-finished');
  assert.equal(kind({ binding: ready, deliveryAttention: { category: 'completed' } }), 'batch-finished');
  assert.equal(kind({ binding: { state: 'closed', turn: { id: 't', state: 'interrupted', terminalReason: 'cancelled' } } }), 'closed', 'an ended session outranks the previous turn');
});

test('run completion never overrides governed task state', () => {
  assert.equal(resolveAgentTaskAttention({ binding: { state: 'ready' }, taskStatus: 'done', deliveryAttention: { category: 'failure' } })?.kind, 'complete');
  assert.equal(resolveAgentTaskAttention({ binding: { state: 'ready' }, taskStatus: 'under-review', deliveryAttention: { category: 'completed' } })?.kind, 'review');
  assert.equal(resolveAgentTaskAttention({ binding: { state: 'ready' }, taskStatus: 'in-progress', deliveryAttention: { category: 'completed' } })?.kind, 'batch-finished', 'finished run, task still in progress');
});

test('bounded delivery activity renders without native event interpretation', () => {
  assert.deepEqual(projectDeliveryActivity(null), []);
  const items = projectDeliveryActivity({ tools: { count: 3, exact: true }, files: null, checks: null, lastActivityAt: '2026-09-25T10:00:00.000Z', entries: [{ id: '1:0', label: 'Tool: Bash', count: 3, at: '2026-09-25T10:00:00.000Z' }] });
  assert.deepEqual(items, [{ id: '1:0', label: 'Tool: Bash', observedAt: '2026-09-25T10:00:00.000Z', count: 3, tone: 'neutral' }]);
});

test('a completed turn from the projection marks the last batch without an event log', () => {
  const binding = { state: 'ready', turn: { id: 't', state: 'completed' } };
  assert.equal(projectAgentRuntimeSession(binding).lastBatchCompleted, false);
  const projection = projectAgentRuntimeSession(binding, [], { turnCompleted: true });
  assert.equal(projection.lastBatchCompleted, true);
  assert.equal(projection.summary?.label, 'Last batch completed');
  assert.equal(projectAgentRuntimeSession({ state: 'ready', turn: { id: 't2', state: 'active' } }, [], { turnCompleted: true }).lastBatchCompleted, false, 'a new in-flight turn is not a finished batch');
});
