import type { GoalElement, GoalElementType, Person } from '../types.ts';

export function createStableId(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${uuid}`;
}

export function createGoalElement(type: GoalElementType, elementCount: number, id = createStableId(type === 'connector' ? 'connector' : 'element')): GoalElement {
  const title = type === 'subgoal' ? 'New subgoal' : type === 'condition' ? 'New condition' : type === 'approval-gate' ? 'Approval gate' : type === 'human-input' ? 'Ask the user' : type === 'retry' ? 'Retry an earlier step' : type === 'deliverable' ? 'New deliverable' : type === 'artifact' ? 'Supporting artifact' : `New ${type}`;
  const body = type === 'condition' ? 'Define the condition to evaluate' : type === 'approval-gate' ? 'Define who must approve and what evidence is required' : type === 'human-input' ? 'Pause for overseer-mediated user input' : type === 'retry' ? 'Return to an earlier completed workflow step' : type === 'deliverable' ? 'Define the expected outcome and delivery handoff' : type === 'artifact' ? 'Declare an execution input or supporting file' : 'Describe the outcome and handoff';
  return {
    id, type, title, body, x: 260 + (elementCount % 3) * 260, y: 560,
    width: 220, height: type === 'human-input' ? 120 : 90, status: 'draft',
    ...(type === 'human-input' ? { humanInputPrompt: 'What input is needed to continue?' } : {}),
    ...(type === 'retry' ? { retryMaxAttempts: 3, retryExhaustionPolicy: 'human-review' as const } : {}),
    ...(type === 'deliverable' ? { deliverableStatus: 'planned' as const, deliverySpec: { outcomeKind: 'other' as const, instructions: '', acceptanceCriteria: [] } } : {}),
    ...(type === 'artifact' ? { artifactRole: 'supporting' as const, artifactReferences: [] } : {}),
  };
}

export function createAgentElement(person: Person, elementCount: number): GoalElement {
  return {
    id: createStableId('element'), type: 'agent', title: person.name, body: person.role, assigneeId: person.id,
    agentConfiguration: { version: 1, mode: 'existing', assigneeId: person.id, instructions: '' },
    x: 260 + (elementCount % 3) * 260, y: 560, width: 220, height: 90, status: 'draft',
  };
}
