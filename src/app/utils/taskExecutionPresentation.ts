import { agentRuntimeTurnState, joinAgentMessageDeltas, selectCurrentAgentRuntimeTurnEvents, type AgentRuntimeActivityEvent, type AgentRuntimeTurnProjection } from './agentRuntimeActivity.ts';

export function getTaskExecutionPresentation({ binding, taskStatus, loading, authenticationRequired, blocked, mcpUnavailable, waitingForPermission, conflict = false }: {
  binding?: { state: string; turn?: AgentRuntimeTurnProjection; taskExecution?: { state?: string } } | null;
  taskStatus: string;
  loading: boolean;
  authenticationRequired: boolean;
  blocked: boolean;
  mcpUnavailable: boolean;
  waitingForPermission: boolean;
  conflict?: boolean;
}) {
  const turn = agentRuntimeTurnState(binding || undefined);
  const connection = authenticationRequired ? 'Unauthorized' : conflict ? 'Conflict'
    : binding?.state === 'starting' || loading && !binding ? 'Connecting'
      : binding && !['closed', 'failed', 'interrupted'].includes(binding.state) ? 'Connected'
        : binding?.state === 'interrupted' || binding?.state === 'closed' ? 'Disconnected' : 'Unavailable';
  const status = taskStatus === 'done' || binding?.taskExecution?.state === 'complete' ? 'Ended'
    : waitingForPermission ? 'Waiting for approval'
      : turn === 'waiting-input' ? 'Waiting for input'
        : turn === 'cancelling' ? 'Stopping'
          : turn === 'active' ? binding?.taskExecution?.state === 'continuing' ? 'Continuing' : 'Working'
            : turn === 'queued' ? 'Queued' : turn === 'starting' || binding?.state === 'starting' ? 'Starting'
              : mcpUnavailable ? 'MCP unavailable'
                : authenticationRequired || blocked || conflict ? 'Blocked'
                  : binding?.state === 'failed' || binding?.taskExecution?.state === 'failed' ? 'Failed'
                    : binding?.taskExecution?.state === 'outcome-unreconciled' ? 'Outcome needs review'
                    : binding?.taskExecution?.state === 'batch-finished' ? 'Batch finished'
                    : taskStatus === 'under-review' || binding?.taskExecution?.state === 'ready-for-review' ? 'Pending review'
                      : binding?.state === 'interrupted' ? 'Stopped'
                        : binding?.state === 'closed' ? 'Ended' : 'Idle';
  return { connection, status };
}

// Keep the previous response visible while a new turn has not produced a message yet.
export function getLatestTaskAgentOutput(events: AgentRuntimeActivityEvent[]) {
  const lastMessage = [...events].reverse().find(event => event.nativeEventType === 'item/agentMessage/delta' && event.messagePreview);
  if (!lastMessage) return '';
  const throughMessage = events.slice(0, events.indexOf(lastMessage) + 1);
  const turnEvents = selectCurrentAgentRuntimeTurnEvents(throughMessage, lastMessage.turnId);
  const responseEvents = turnEvents.length ? turnEvents : throughMessage;
  // Item boundaries separate the final response from earlier tool-use commentary.
  let responseStart = 0;
  responseEvents.forEach((event, index) => {
    if (event.nativeEventType === 'item/started' || event.nativeEventType === 'item/completed') responseStart = index + 1;
  });
  return joinAgentMessageDeltas(responseEvents.slice(responseStart)
    .filter(event => event.nativeEventType === 'item/agentMessage/delta' && event.messagePreview)
    .map(event => event.messagePreview || ''));
}

export function taskNeedsProviderSignIn(binding: { state: string; taskExecution?: { state?: string } } | null, failureClass: string | undefined, output: string) {
  return Boolean(binding && (['failed', 'interrupted'].includes(binding.state) || binding.taskExecution?.state === 'failed')
    && (failureClass === 'unauthorized' || /failed to authenticate|oauth session expired|authentication required|requires sign-in/i.test(output)));
}
