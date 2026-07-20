import { AlertTriangle, CheckCircle2, CircleDot, ClipboardCheck, LockKeyhole, MessageSquareText, RotateCcw, ShieldCheck, Sparkles, Target, UserRoundCheck } from 'lucide-react';
import type { GoalElement, GoalElementReadiness, GoalElementType, Person } from '../../types.ts';
import { AgentIcon as Bot } from '../icons/AgentIcon';
import { AttachmentIcon } from '../icons/AttachmentIcon';
import { PuzzlePieceIcon } from '../icons/PuzzlePieceIcon';

const EXECUTION_LOCKED_STATUSES = new Set(['working', 'blocked', 'evidence-required', 'approval-required', 'complete', 'permission-denied']);

export function compactChipClass(colorClass: string): string {
  return `${colorClass} !gap-0.5 !rounded-full !border !px-1.5 !py-0 !text-[10px] [&>svg]:!mr-0 [&>svg]:!size-2.5`;
}

export function isExecutionLocked(element: GoalElement | undefined): boolean {
  return Boolean(element?.status && EXECUTION_LOCKED_STATUSES.has(element.status));
}

export function nodeClass(type: GoalElementType, connected = true): string {
  if (!connected && type === 'instructions') return 'border-slate-200 bg-slate-100 text-slate-500';
  if (type === 'goal') return 'border-slate-900 bg-slate-900 text-white';
  if (type === 'subgoal') return 'border-blue-200 bg-white text-slate-900';
  if (type === 'agent') return 'border-amber-200 bg-amber-50 text-slate-900';
  if (type === 'condition') return 'border-violet-200 bg-violet-50 text-slate-900';
  if (type === 'approval-gate') return 'border-orange-200 bg-orange-50 text-slate-900';
  if (type === 'human-input') return 'border-sky-200 bg-sky-50 text-slate-900';
  if (type === 'retry') return 'border-cyan-200 bg-cyan-50 text-slate-900';
  if (type === 'deliverable') return 'border-emerald-200 bg-emerald-50 text-slate-900';
  if (type === 'artifact') return 'border-sky-200 bg-sky-50 text-slate-900';
  return 'border-slate-200 bg-white text-slate-700';
}

export function elementIcon(type: GoalElementType) {
  if (type === 'agent') return <Bot className="size-3.5" />;
  if (type === 'goal') return <Sparkles className="size-3.5" />;
  if (type === 'human-input') return <MessageSquareText className="size-3.5" />;
  if (type === 'retry') return <RotateCcw className="size-3.5" />;
  if (type === 'deliverable') return <PuzzlePieceIcon className="size-3.5" />;
  if (type === 'artifact') return <AttachmentIcon className="size-3.5" />;
  return <Target className="size-3.5" />;
}

export function getAgentForElement(element: GoalElement, people: Person[]): Person | undefined {
  return element.type === 'agent' ? people.find(person => person.id === element.assigneeId) : undefined;
}

export function getElementTitle(element: GoalElement, people: Person[]): string {
  return getAgentForElement(element, people)?.name ?? element.title;
}

export function getElementBody(element: GoalElement, people: Person[]): string | undefined {
  return getAgentForElement(element, people)?.role ?? element.body;
}

export function statusChipClass(status: GoalElement['status']): string {
  if (status === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'working') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'blocked') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'evidence-required') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'approval-required') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (status === 'permission-denied') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'human-review') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

export function statusLabel(status: GoalElement['status']): string {
  return status === 'evidence-required' ? 'Evidence required' : status === 'approval-required' ? 'Approval required' : status === 'permission-denied' ? 'Permission denied' : status === 'human-review' ? 'Human review' : status ?? 'Draft';
}

export function statusDescription(status: GoalElement['status']): string {
  return status === 'blocked' ? 'The overseer has stopped this node until its blocking reason is resolved.' : status === 'evidence-required' ? 'Attach the required evidence before this node can hand off.' : status === 'approval-required' ? 'Waiting for the configured approval gate.' : status === 'permission-denied' ? 'The requested action is not allowed by the current permissions.' : status === 'human-review' ? 'A human reviewer must inspect the evidence before continuing.' : 'Managed by the overseer after acceptance criteria are evaluated.';
}

export function statusNextStep(status: GoalElement['status']): string | undefined {
  return status === 'blocked' ? 'Resolve the blocking reason, then ask the overseer to reassess this node.' : status === 'evidence-required' ? 'Attach the missing evidence before requesting handoff.' : status === 'approval-required' ? 'Request a decision from the configured approval actor.' : status === 'permission-denied' ? 'Ask an administrator to grant the required permission.' : status === 'human-review' ? 'Review the evidence and record an accept or reject decision.' : undefined;
}

export function readinessForElement(element: GoalElement, connected: boolean): GoalElementReadiness {
  if (element.readiness) return element.readiness;
  if (element.type === 'agent') {
    const configuration = element.agentConfiguration;
    if (!configuration) return element.assigneeId ? 'unavailable' : 'not-ready';
    if (configuration.mode === 'existing') return configuration.assigneeId ? 'ready' : 'unavailable';
    return configuration.requestedName || configuration.autoGenerateName ? (configuration.instructions.trim() ? 'ready' : 'needs-review') : 'not-ready';
  }
  if (element.type === 'instructions') return connected ? 'ready' : 'not-ready';
  if (element.type === 'human-input') return element.humanInputPrompt?.trim() && connected ? 'ready' : 'needs-review';
  if (element.type === 'retry') return element.retryMaxAttempts && connected ? 'ready' : 'needs-review';
  if (element.type === 'deliverable') return element.deliverySpec?.instructions.trim() && connected ? 'ready' : 'needs-review';
  if (element.type === 'artifact') return (element.artifactReferences?.length ?? 0) > 0 && connected ? 'ready' : 'needs-review';
  if (element.type === 'condition') return element.conditionPositiveOutcome && element.conditionNegativeOutcome ? 'ready' : 'needs-review';
  if (element.type === 'approval-gate') return element.policy?.acceptanceActor ? 'ready' : 'needs-review';
  return 'ready';
}

export function readinessLabel(readiness: GoalElementReadiness): string {
  return readiness === 'not-ready' ? 'Not ready' : readiness === 'needs-review' ? 'Needs review' : readiness === 'unavailable' ? 'Unavailable' : 'Ready';
}

export function readinessChipClass(readiness: GoalElementReadiness): string {
  const colorClass = readiness === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : readiness === 'unavailable' ? 'border-red-200 bg-red-50 text-red-700' : readiness === 'needs-review' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-100 text-slate-600';
  return compactChipClass(colorClass);
}

export function ReadyIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-label="Ready" role="img"><title>Ready</title><path d="M8,0C3.6,0,0,3.6,0,8s3.6,8,8,8,8-3.6,8-8S12.4,0,8,0Zm3.707,6.707l-4,4c-.195,.195-.451,.293-.707,.293s-.512-.098-.707-.293l-2-2c-.391-.391-.391-1.023,0-1.414s1.023-.391,1.414,0l1.293,1.293,3.293-3.293c.391-.391,1.023-.391,1.414,0,0,.391,0,1.023-.391,1.414Z" fill="#71717A" /></svg>;
}

export function readinessDescription(element: GoalElement, readiness: GoalElementReadiness): string {
  if (element.readinessReason) return element.readinessReason;
  if (readiness === 'ready') return 'Configured and available for use in the workflow.';
  if (element.type === 'agent') return element.agentConfiguration?.mode === 'ephemeral' ? (element.agentConfiguration.instructions.trim() ? 'Temporary-agent recruitment is overseer-managed.' : 'Add task-specific instructions before this node can be dispatched.') : element.agentConfiguration?.spawnIfUnavailable ? 'The canonical agent is unavailable; the overseer may recruit a temporary agent.' : 'Select a canonical agent before this node can be dispatched.';
  if (element.type === 'instructions') return 'Connect this node to a workflow step before it can be used.';
  if (element.type === 'human-input') return 'Define the prompt and connect this node before it can pause the workflow.';
  if (element.type === 'retry') return 'Set a retry limit and connect this node to an earlier workflow step.';
  if (element.type === 'deliverable') return 'Define delivery instructions and connect this node to the Goal, Subgoal, or Agent that produces it.';
  if (element.type === 'artifact') return 'Declare a supporting file, document, URL, or user-defined input and connect it to the workflow.';
  if (element.type === 'condition') return 'Define both branch outcomes before this condition can be evaluated.';
  if (element.type === 'approval-gate') return 'Configure the approval actor before this gate can be used.';
  return 'This node is not ready for use in the workflow.';
}

export function isCompletionElement(element: GoalElement): boolean { return element.type === 'goal' || element.type === 'subgoal'; }
export function conditionPositiveLabel(element: GoalElement): string { return element.conditionPositiveLabel ?? element.conditionTrueLabel ?? 'True'; }
export function conditionNegativeLabel(element: GoalElement): string { return element.conditionNegativeLabel ?? element.conditionFalseLabel ?? 'False'; }

export function StatusIcon({ status, className = 'size-3' }: { status: GoalElement['status']; className?: string }) {
  if (status === 'blocked' || status === 'permission-denied') return status === 'permission-denied' ? <LockKeyhole className={className} /> : <AlertTriangle className={className} />;
  if (status === 'evidence-required') return <ClipboardCheck className={className} />;
  if (status === 'approval-required') return <ShieldCheck className={className} />;
  if (status === 'human-review') return <UserRoundCheck className={className} />;
  if (status === 'complete') return <CheckCircle2 className={className} />;
  return <CircleDot className={className} />;
}
