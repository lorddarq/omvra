import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, ClipboardCheck, LoaderCircle, LockKeyhole, MessageSquareText, Minus, Plus, RotateCcw, ShieldCheck, Sparkles, Target, Trash2, UserRoundCheck, ZoomIn } from 'lucide-react';
import type { GoalAcceptanceActor, GoalAgentConfiguration, GoalAgentMode, GoalArtifactReference, GoalBudgetMode, GoalConditionBranch, GoalConnectorSide, GoalElement, GoalElementReadiness, GoalElementType, GoalPolicy, GoalPolicyDimension, GoalPolicyDimensionOverride, GoalRecord, GoalRetryExhaustionPolicy, GoalSchedule, Person, ProjectMilestone, Task } from '../../types.ts';
import type { GoalPolicyV1 } from '../../utils/goalPolicy.ts';
import { GOAL_TEMPLATES, instantiateGoalTemplate, type GoalTemplate } from '../../data/goalTemplates.ts';
import { getCanonicalJSON, safeReadJSON, setCanonicalJSON } from '../../utils/storage.ts';
import { isGoalElementConnected, isValidRetryTarget, wouldCreateGoalCycle } from '../../utils/goalCanvas.ts';
import { AgentIcon as Bot } from '../icons/AgentIcon';
import { DropdownChevron } from '../icons/DropdownChevron';
import { WorkflowsIcon } from '../icons/WorkflowsIcon';
import { LinkIcon as Link2 } from '../icons/LinkIcon';
import { PuzzlePieceIcon } from '../icons/PuzzlePieceIcon';
import { AttachmentIcon } from '../icons/AttachmentIcon';
import { AwardCertificateIcon } from '../icons/AwardCertificateIcon';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { GoalTemplatesPopover } from '../GoalTemplatesPopover';
import { GOAL_SCHEDULES_STORAGE_KEY, normalizeGoalSchedules, scheduleStatus } from '../../utils/goalSchedules.ts';

const STORAGE_KEY = 'omvra.goals.v1';
const GOAL_ID = 'goal-lights-off-factory';
const GOAL_POLICY_DIMENSIONS: Array<{ key: GoalPolicyDimension; label: string; unit: GoalPolicyDimensionOverride['unit']; legacyMode: keyof GoalPolicy; legacyValue: keyof GoalPolicy }> = [
  { key: 'financial', label: 'Financial cost', unit: 'USD', legacyMode: 'financialBudgetMode', legacyValue: 'maxFinancialCost' },
  { key: 'tokens', label: 'Tokens', unit: 'tokens', legacyMode: 'tokenBudgetMode', legacyValue: 'maxTokens' },
  { key: 'concurrency', label: 'Concurrent loops', unit: 'loops', legacyMode: 'concurrencyBudgetMode', legacyValue: 'maxConcurrentLoops' },
  { key: 'attempts', label: 'Total loop attempts', unit: 'attempts', legacyMode: 'loopAttemptsBudgetMode', legacyValue: 'maxLoopAttempts' },
  { key: 'retries', label: 'Retries / rework', unit: 'retries', legacyMode: 'retryBudgetMode', legacyValue: 'maxRetries' },
];
const GOAL_POLICY_SAFE_VALUES: Record<GoalPolicyDimension, number> = { financial: 10, tokens: 100000, concurrency: 1, attempts: 10, retries: 2 };
const EXECUTION_LOCKED_STATUSES = new Set(['working', 'blocked', 'evidence-required', 'approval-required', 'complete', 'permission-denied']);
const ARTIFACT_SELECT_CLASS = 'h-9 rounded-xl border-[#e5e7eb] bg-white px-3 text-sm font-medium text-[#71717a] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-gray-200';
type GoalRuntimeProjection = { execution?: { state?: string; revision?: number; attempt?: number; policyRevision?: number; executionAttemptId?: string; reconciliationRequired?: boolean } | null; handoffs?: Array<{ id: string; deliverableId?: string; producedArtifactReferences?: Array<{ label?: string; locator?: string; format?: string }>; deliveryFacts?: Record<string, unknown>; deliveredAt?: string }>; effectivePolicy?: GoalPolicyV1 | null; policyRevision?: number; executionAttempt?: number | null; executionAttemptId?: string | null; agentAvailability?: Array<{ elementId: string; available: boolean; errorCode?: string | null }>; policyImpacts?: Array<{ goalId?: string; status?: string; requiresUserConfirmation?: boolean }>; lastChange?: { scope?: string; errorCode?: string; changeType?: string } | null };
type SupportingArtifactType = 'document' | 'file' | 'url' | 'user-defined';

function isExecutionLocked(element: GoalElement | undefined): boolean {
  return Boolean(element?.status && EXECUTION_LOCKED_STATUSES.has(element.status));
}

function goalRevision(goal: GoalRecord): number {
  const revision = Number((goal as GoalRecord & { revision?: number; __mcpRevision?: number }).revision ?? (goal as GoalRecord & { __mcpRevision?: number }).__mcpRevision ?? 0);
  return Number.isFinite(revision) ? Math.max(0, Math.floor(revision)) : 0;
}

function inspectorDefaultDimension(dimension: GoalPolicyDimension): { constrained: true; mode: Exclude<GoalBudgetMode, 'unbounded'>; value: number; unit: GoalPolicyDimensionOverride['unit'] } {
  const metadata = GOAL_POLICY_DIMENSIONS.find(item => item.key === dimension)!;
  return { constrained: true, mode: 'hard-cap', value: GOAL_POLICY_SAFE_VALUES[dimension], unit: metadata.unit };
}

function legacyDimensionOverride(policy: GoalPolicy | undefined, dimension: GoalPolicyDimension): GoalPolicyDimensionOverride | undefined {
  if (!policy) return undefined;
  const metadata = GOAL_POLICY_DIMENSIONS.find(item => item.key === dimension)!;
  const mode = policy[metadata.legacyMode];
  const value = policy[metadata.legacyValue];
  if (mode === 'unbounded') return { constrained: false };
  if (typeof mode === 'string' && typeof value === 'number' && value > 0) {
    return { constrained: true, mode: mode as Exclude<GoalBudgetMode, 'unbounded'>, value, unit: metadata.unit };
  }
  return undefined;
}

function resolveInspectorPolicy(workspacePolicy: GoalPolicyV1 | undefined, goal: GoalRecord, target: GoalElement) {
  const dimensions = { ...(workspacePolicy?.dimensions ?? {}) } as GoalPolicyV1['dimensions'];
  const effective = {
    dimensions: GOAL_POLICY_DIMENSIONS.reduce((result, dimension) => {
      result[dimension.key] = dimensions[dimension.key] ?? inspectorDefaultDimension(dimension.key);
      return result;
    }, {} as GoalPolicyV1['dimensions']),
    acceptance: workspacePolicy?.acceptance ?? { actor: 'human' as const },
  };
  const applyScope = (policy: GoalPolicy | undefined) => {
    for (const dimension of GOAL_POLICY_DIMENSIONS) {
      const override = policy?.dimensions?.[dimension.key] ?? legacyDimensionOverride(policy, dimension.key);
      const current = effective.dimensions[dimension.key];
      if (!override || override.constrained === false) continue;
      if (!current.constrained || (override.value !== undefined && override.value <= current.value && override.unit === current.unit)) {
        effective.dimensions[dimension.key] = { ...current, ...override, constrained: true, unit: dimension.unit } as typeof current;
      }
    }
    const actor = policy?.acceptanceActor;
    const rank = { agentic: 1, human: 2, both: 3 } as const;
    if (actor && rank[actor] > rank[effective.acceptance.actor]) effective.acceptance = { actor };
  };
  applyScope(goal.policy);
  const incoming = new Map<string, string[]>();
  goal.elements.filter(element => element.type === 'connector' && element.sourceId && element.targetId).forEach(connection => {
    const parents = incoming.get(connection.targetId!) ?? [];
    parents.push(connection.sourceId!);
    incoming.set(connection.targetId!, parents);
  });
  const visited = new Set<string>([target.id]);
  const pending = [...(incoming.get(target.id) ?? [])];
  const ancestors: GoalElement[] = [];
  while (pending.length) {
    const id = pending.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const ancestor = goal.elements.find(element => element.id === id);
    if (ancestor) {
      if (ancestor.type === 'subgoal') ancestors.unshift(ancestor);
      pending.push(...(incoming.get(id) ?? []));
    }
  }
  ancestors.forEach(ancestor => applyScope(ancestor.policy));
  applyScope(target.policy);
  return effective;
}

function createStableId(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${uuid}`;
}

const TOOL_ITEMS: Array<{ type: GoalElementType; label: string; icon: ReactNode }> = [
  { type: 'agent', label: 'Agent', icon: <Bot className="size-3.5" /> },
  { type: 'subgoal', label: 'Subgoal', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>tasks-2</title><g fill="currentColor"><path opacity="0.3" d="M13.75 5.25H7.25C6.145 5.25 5.25 6.145 5.25 7.25V13.75C5.25 14.855 6.145 15.75 7.25 15.75H13.75C14.855 15.75 15.75 14.855 15.75 13.75V7.25C15.75 6.145 14.855 5.25 13.75 5.25Z" fill="currentColor" data-stroke="none" stroke="none" /><path d="M7.99695 11.25L9.60596 12.75L13.003 8.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M13.75 5.25H7.25C6.145 5.25 5.25 6.145 5.25 7.25V13.75C5.25 14.855 6.145 15.75 7.25 15.75H13.75C14.855 15.75 15.75 14.855 15.75 13.75V7.25C15.75 6.145 14.855 5.25 13.75 5.25Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M12.4012 2.74996C12.0022 2.06146 11.2151 1.64841 10.38 1.77291L3.45602 2.80196C2.36402 2.96386 1.61003 3.98093 1.77203 5.07393L2.75002 11.6547" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'connector', label: 'Connector', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>link</title><g fill="currentColor"><path d="M14.6892 9.66862L12.5298 7.5092C11.1486 6.12805 8.90935 6.12805 7.5282 7.5092C6.14704 8.89036 6.14704 11.1296 7.5282 12.5108L9.68761 14.6702C11.0688 16.0514 13.3081 16.0514 14.6892 14.6702C16.0704 13.2891 16.0704 11.0498 14.6892 9.66862Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" /><path d="M8.36909 6.8934C8.06649 7.0539 7.78239 7.2617 7.52799 7.517L7.51799 7.527C6.13699 8.908 6.13699 11.146 7.51799 12.527L9.69299 14.702C11.074 16.083 13.312 16.083 14.693 14.702L14.703 14.692C16.084 13.311 16.084 11.073 14.703 9.692L13.9406 8.9296" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M9.63288 11.1066C9.93548 10.9461 10.2196 10.7383 10.474 10.483L10.484 10.473C11.865 9.09199 11.865 6.85399 10.484 5.47299L8.30899 3.29799C6.92799 1.91699 4.68999 1.91699 3.30899 3.29799L3.29899 3.30799C1.91799 4.68899 1.91799 6.92699 3.29899 8.30799L4.06139 9.07039" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'instructions', label: 'Instructions', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>clipboard-check</title><g fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M6.25 2.75V3.25C6.25 3.80228 6.69772 4.25 7.25 4.25H10.75C11.3023 4.25 11.75 3.80228 11.75 3.25V2.75H12.75C13.855 2.75 14.75 3.645 14.75 4.75V14.25C14.75 15.355 13.855 16.25 12.75 16.25H5.25C4.145 16.25 3.25 15.355 3.25 14.25V4.75C3.25 3.645 4.145 2.75 5.25 2.75H6.25Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" /><path d="M6.25 2.75H5.25C4.145 2.75 3.25 3.645 3.25 4.75V14.25C3.25 15.355 4.145 16.25 5.25 16.25H12.75C13.855 16.25 14.75 15.355 14.75 14.25V4.75C14.75 3.645 13.855 2.75 12.75 2.75H11.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M10.75 1.25H7.25C6.69772 1.25 6.25 1.69772 6.25 2.25V3.25C6.25 3.80228 6.69772 4.25 7.25 4.25H10.75C11.3023 4.25 11.75 3.80228 11.75 3.25V2.25C11.75 1.69772 11.3023 1.25 10.75 1.25Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M6.25 10.25L8 12.25L11.75 7.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'condition', label: 'Condition', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>nodes</title><g fill="currentColor"><path opacity="0.3" d="M9 5.75C10.105 5.75 11 4.855 11 3.75C11 2.645 10.105 1.75 9 1.75C7.895 1.75 7 2.645 7 3.75C7 4.855 7.895 5.75 9 5.75Z" fill="currentColor" data-stroke="none" stroke="none" /><path opacity="0.3" d="M3.80396 14.75C4.90896 14.75 5.80396 13.855 5.80396 12.75C5.80396 11.645 4.90896 10.75 3.80396 10.75C2.69896 10.75 1.80396 11.645 1.80396 12.75C1.80396 13.855 2.69896 14.75 3.80396 14.75Z" fill="currentColor" data-stroke="none" stroke="none" /><path opacity="0.3" d="M14.196 14.75C15.301 14.75 16.196 13.855 16.196 12.75C16.196 11.645 15.301 10.75 14.196 10.75C13.091 10.75 12.196 11.645 12.196 12.75C12.196 13.855 13.091 14.75 14.196 14.75Z" fill="currentColor" data-stroke="none" stroke="none" /><path d="M10.998 3.82599C12.8602 4.45429 14.3295 5.93581 14.9409 7.80551" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M2.87098 10.981C2.48388 9.05459 3.03209 7.041 4.34559 5.5766" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M13.131 14.443C11.655 15.743 9.63592 16.2743 7.70972 15.8675" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M9 5.75C10.105 5.75 11 4.855 11 3.75C11 2.645 10.105 1.75 9 1.75C7.895 1.75 7 2.645 7 3.75C7 4.855 7.895 5.75 9 5.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M3.80396 14.75C4.90896 14.75 5.80396 13.855 5.80396 12.75C5.80396 11.645 4.90896 10.75 3.80396 10.75C2.69896 10.75 1.80396 11.645 1.80396 12.75C1.80396 13.855 2.69896 14.75 3.80396 14.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M14.196 14.75C15.301 14.75 16.196 13.855 16.196 12.75C16.196 11.645 15.301 10.75 14.196 10.75C13.091 10.75 12.196 11.645 12.196 12.75C12.196 13.855 13.091 14.75 14.196 14.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'approval-gate', label: 'Approval gate', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>thumbs-up</title><g fill="currentColor"><path d="M5.25 7.494C5.25 7.014 5.423 6.55 5.736 6.187L10 1.25C10.854 1.677 11.25 2.678 10.92 3.574L9.75 6.75H14.152C15.465 6.75 16.421 7.993 16.085 9.262L14.894 13.762C14.662 14.639 13.868 15.25 12.961 15.25H7.25C6.145 15.25 5.25 14.355 5.25 13.25" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" /><path d="M5.25 7.494C5.25 7.014 5.423 6.55 5.736 6.187L10 1.25C10.854 1.677 11.25 2.678 10.92 3.574L9.75 6.75H14.152C15.465 6.75 16.421 7.993 16.085 9.262L14.894 13.762C14.662 14.639 13.868 15.25 12.961 15.25H7.25C6.145 15.25 5.25 14.355 5.25 13.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M4.25 6.75H2.75C2.19772 6.75 1.75 7.19772 1.75 7.75V14.25C1.75 14.8023 2.19772 15.25 2.75 15.25H4.25C4.80228 15.25 5.25 14.8023 5.25 14.25V7.75C5.25 7.19772 4.80228 6.75 4.25 6.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'goal', label: 'Goal', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>flag-7</title><g fill="currentColor"><path d="M3.75 3.25H11.25C11.802 3.25 12.25 3.698 12.25 4.25V9.25H3.75" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" /><path d="M3.75 3.25H11.25C11.802 3.25 12.25 3.698 12.25 4.25V9.25H3.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M12.25 5.75H14.25C14.802 5.75 15.25 6.198 15.25 6.75V10.75C15.25 11.302 14.802 11.75 14.25 11.75H10.75C10.198 11.75 9.75 11.302 9.75 10.75V9.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M10.043 11.457L12.25 9.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M3.75 1.75V16.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
];
const ARTIFACT_ITEMS: Array<{ type: Extract<GoalElementType, 'artifact' | 'deliverable'>; label: string; description: string; icon: ReactNode }> = [
  { type: 'artifact', label: 'Supporting artifact', description: 'Add execution input or context', icon: <AttachmentIcon className="size-3.5" /> },
  { type: 'deliverable', label: 'Deliverable', description: 'Define an expected output', icon: <PuzzlePieceIcon className="size-3.5" /> },
];
const CONTROL_FLOW_ITEMS: Array<{ type: Extract<GoalElementType, 'human-input' | 'retry'>; label: string; icon: ReactNode }> = [
  { type: 'human-input', label: 'Human input', icon: <MessageSquareText className="size-3.5" /> },
  { type: 'retry', label: 'Retry', icon: <RotateCcw className="size-3.5" /> },
];

function readGoals(): GoalRecord[] {
  const stored = safeReadJSON<GoalRecord[]>(STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(goal => goal.id !== GOAL_ID);
}

function nodeClass(type: GoalElementType, connected = true): string {
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

function statusChipClass(status: GoalElement['status']): string {
  if (status === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'working') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'blocked') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'evidence-required') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'approval-required') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (status === 'permission-denied') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'human-review') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function compactChipClass(colorClass: string): string {
  return `${colorClass} !gap-0.5 !rounded-full !border !px-1.5 !py-0 !text-[10px] [&>svg]:!mr-0 [&>svg]:!size-2.5`;
}

function statusLabel(status: GoalElement['status']): string {
  return status === 'evidence-required' ? 'Evidence required'
    : status === 'approval-required' ? 'Approval required'
      : status === 'permission-denied' ? 'Permission denied'
        : status === 'human-review' ? 'Human review'
          : status ?? 'Draft';
}

function statusDescription(status: GoalElement['status']): string {
  return status === 'blocked' ? 'The overseer has stopped this node until its blocking reason is resolved.'
    : status === 'evidence-required' ? 'Attach the required evidence before this node can hand off.'
      : status === 'approval-required' ? 'Waiting for the configured approval gate.'
        : status === 'permission-denied' ? 'The requested action is not allowed by the current permissions.'
          : status === 'human-review' ? 'A human reviewer must inspect the evidence before continuing.'
            : 'Managed by the overseer after acceptance criteria are evaluated.';
}

function statusNextStep(status: GoalElement['status']): string | undefined {
  return status === 'blocked' ? 'Resolve the blocking reason, then ask the overseer to reassess this node.'
    : status === 'evidence-required' ? 'Attach the missing evidence before requesting handoff.'
      : status === 'approval-required' ? 'Request a decision from the configured approval actor.'
        : status === 'permission-denied' ? 'Ask an administrator to grant the required permission.'
          : status === 'human-review' ? 'Review the evidence and record an accept or reject decision.'
            : undefined;
}

function readinessForElement(element: GoalElement, connected: boolean): GoalElementReadiness {
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

function readinessLabel(readiness: GoalElementReadiness): string {
  return readiness === 'not-ready' ? 'Not ready'
    : readiness === 'needs-review' ? 'Needs review'
      : readiness === 'unavailable' ? 'Unavailable'
        : 'Ready';
}

function readinessChipClass(readiness: GoalElementReadiness): string {
  const colorClass = readiness === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : readiness === 'unavailable' ? 'border-red-200 bg-red-50 text-red-700'
      : readiness === 'needs-review' ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-100 text-slate-600';
  return compactChipClass(colorClass);
}

function ReadyIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-label="Ready" role="img"><title>Ready</title><path d="M8,0C3.6,0,0,3.6,0,8s3.6,8,8,8,8-3.6,8-8S12.4,0,8,0Zm3.707,6.707l-4,4c-.195,.195-.451,.293-.707,.293s-.512-.098-.707-.293l-2-2c-.391-.391-.391-1.023,0-1.414s1.023-.391,1.414,0l1.293,1.293,3.293-3.293c.391-.391,1.023-.391,1.414,0s.391,1.023,0,1.414Z" fill="#71717A" /></svg>;
}

function readinessDescription(element: GoalElement, readiness: GoalElementReadiness): string {
  if (element.readinessReason) return element.readinessReason;
  if (readiness === 'ready') return 'Configured and available for use in the workflow.';
  if (element.type === 'agent') {
    if (element.agentConfiguration?.mode === 'ephemeral') return element.agentConfiguration.instructions.trim() ? 'Temporary-agent recruitment is overseer-managed.' : 'Add task-specific instructions before this node can be dispatched.';
    return element.agentConfiguration?.spawnIfUnavailable ? 'The canonical agent is unavailable; the overseer may recruit a temporary agent.' : 'Select a canonical agent before this node can be dispatched.';
  }
  if (element.type === 'instructions') return 'Connect this node to a workflow step before it can be used.';
  if (element.type === 'human-input') return 'Define the prompt and connect this node before it can pause the workflow.';
  if (element.type === 'retry') return 'Set a retry limit and connect this node to an earlier workflow step.';
  if (element.type === 'deliverable') return 'Define delivery instructions and connect this node to the Goal, Subgoal, or Agent that produces it.';
  if (element.type === 'artifact') return 'Declare a supporting file, document, URL, or user-defined input and connect it to the workflow.';
  if (element.type === 'condition') return 'Define both branch outcomes before this condition can be evaluated.';
  if (element.type === 'approval-gate') return 'Configure the approval actor before this gate can be used.';
  return 'This node is not ready for use in the workflow.';
}

function isCompletionElement(element: GoalElement): boolean {
  return element.type === 'goal' || element.type === 'subgoal';
}

function conditionPositiveLabel(element: GoalElement): string {
  return element.conditionPositiveLabel ?? element.conditionTrueLabel ?? 'True';
}

function conditionNegativeLabel(element: GoalElement): string {
  return element.conditionNegativeLabel ?? element.conditionFalseLabel ?? 'False';
}

function StatusIcon({ status, className = 'size-3' }: { status: GoalElement['status']; className?: string }) {
  if (status === 'blocked' || status === 'permission-denied') return status === 'permission-denied' ? <LockKeyhole className={className} /> : <AlertTriangle className={className} />;
  if (status === 'evidence-required') return <ClipboardCheck className={className} />;
  if (status === 'approval-required') return <ShieldCheck className={className} />;
  if (status === 'human-review') return <UserRoundCheck className={className} />;
  if (status === 'complete') return <CheckCircle2 className={className} />;
  return <CircleDot className={className} />;
}

function elementIcon(type: GoalElementType) {
  if (type === 'agent') return <Bot className="size-3.5" />;
  if (type === 'goal') return <Sparkles className="size-3.5" />;
  if (type === 'human-input') return <MessageSquareText className="size-3.5" />;
  if (type === 'retry') return <RotateCcw className="size-3.5" />;
  if (type === 'deliverable') return <PuzzlePieceIcon className="size-3.5" />;
  if (type === 'artifact') return <AttachmentIcon className="size-3.5" />;
  return <Target className="size-3.5" />;
}

export function GoalsView({ people = [], tasks = [], milestones = [], workspacePolicy, goalAuditArchiveDirectory = '', onGoalAuditArchiveDirectoryChange }: { people?: Person[]; tasks?: Task[]; milestones?: ProjectMilestone[]; workspacePolicy?: GoalPolicyV1; goalAuditArchiveDirectory?: string; onGoalAuditArchiveDirectoryChange?: (directory: string) => void }) {
  const [goals, setGoals] = useState<GoalRecord[]>(readGoals);
  const goalsRef = useRef<GoalRecord[]>([]);
  goalsRef.current = goals;
  const canonicalGoalsRef = useRef<GoalRecord[]>([]);
  const [schedules, setSchedules] = useState<GoalSchedule[]>(() => normalizeGoalSchedules(safeReadJSON<unknown>(GOAL_SCHEDULES_STORAGE_KEY, [])));
  const [schedulesHydrated, setSchedulesHydrated] = useState(false);
  const [canonicalHydrated, setCanonicalHydrated] = useState(false);
  const canonicalWrite = useRef(Promise.resolve());
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedElementId, setSelectedElementId] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const spaceHeldRef = useRef(false);
  const panSessionRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [controlFlowMenuOpen, setControlFlowMenuOpen] = useState(false);
  const [artifactMenuOpen, setArtifactMenuOpen] = useState(false);
  const [policyImpacts, setPolicyImpacts] = useState<Array<{ goalId?: string; status?: string; requiresUserConfirmation?: boolean }>>([]);
  const [runtimeProjection, setRuntimeProjection] = useState<GoalRuntimeProjection | null>(null);
  const agentMenuRef = useRef<HTMLDivElement | null>(null);
  const controlFlowMenuRef = useRef<HTMLDivElement | null>(null);
  const artifactMenuRef = useRef<HTMLDivElement | null>(null);
  const [connectorMode, setConnectorMode] = useState(false);
  const [connectorSourceId, setConnectorSourceId] = useState<string | null>(null);
  const [connectorSourceSide, setConnectorSourceSide] = useState<GoalConnectorSide>('right');
  const [connectorSourceBranch, setConnectorSourceBranch] = useState<GoalConditionBranch | undefined>();
  const [rewireConnectorId, setRewireConnectorId] = useState<string | null>(null);
  const [connectorError, setConnectorError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newGoalDialogOpen, setNewGoalDialogOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalBody, setNewGoalBody] = useState('');
  const [customArtifactLabel, setCustomArtifactLabel] = useState('');
  const [customArtifactKind, setCustomArtifactKind] = useState('document');
  const [customArtifactFormat, setCustomArtifactFormat] = useState('');
  const [customArtifactLocator, setCustomArtifactLocator] = useState('');
  const [supportingArtifactType, setSupportingArtifactType] = useState<SupportingArtifactType>('document');
  const [supportingSourceSearch, setSupportingSourceSearch] = useState('');
  const [canvasElementHeights, setCanvasElementHeights] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const draggingRef = useRef(false);
  const localMutationRef = useRef(false);
  const rendererWritesPendingRef = useRef(0);
  const scheduleWritesPendingRef = useRef(0);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeGoal = goals.find(goal => goal.id === selectedGoalId) ?? goals[0];
  const activeSchedule = activeGoal ? schedules.find(schedule => schedule.goalId === activeGoal.id) : undefined;
  const selectedElement = activeGoal?.elements.find(element => element.id === selectedElementId) ?? activeGoal?.elements[0];
  const selectedAgent = selectedElement?.type === 'agent' ? people.find(person => person.id === selectedElement.assigneeId) : undefined;
  const selectedAgentMissing = selectedElement?.type === 'agent' && selectedElement.agentConfiguration?.mode === 'existing' && (!selectedElement.agentConfiguration.assigneeId || !selectedAgent);
  const selectedAgentConfiguration = selectedElement?.type === 'agent' ? selectedElement.agentConfiguration : undefined;
  const selectedAgentMode: GoalAgentMode | undefined = selectedElement?.type === 'agent'
    ? selectedAgentConfiguration?.mode ?? (selectedElement.assigneeId ? 'existing' : 'ephemeral')
    : undefined;
  const selectedRetryTarget = selectedElement?.type === 'retry'
    ? activeGoal?.elements.find(element => element.type === 'connector' && element.sourceId === selectedElement.id)?.targetId
    : undefined;
  const selectedPolicyElement = selectedElement?.type === 'goal' || selectedElement?.type === 'subgoal' || selectedElement?.type === 'approval-gate' ? selectedElement : undefined;
  const selectedElementLocked = isExecutionLocked(selectedElement);
  const selectedEffectivePolicy = activeGoal && selectedPolicyElement
    ? (runtimeProjection?.effectivePolicy ?? resolveInspectorPolicy(workspacePolicy, activeGoal, selectedPolicyElement))
    : undefined;
  const selectedPolicyImpact = (runtimeProjection?.policyImpacts ?? policyImpacts).find(impact => impact.goalId === activeGoal?.id && impact.status === 'pending');
  const selectedArtifactReferences = selectedElement?.type === 'goal' || selectedElement?.type === 'subgoal' || selectedElement?.type === 'artifact' ? (selectedElement.artifactReferences ?? []) : [];
  const artifactOptions = [
    ...tasks.map(task => ({ value: `task:${task.id}`, label: `Task · ${task.title}`, searchText: task.title, artifactType: 'task' as const, artifactId: task.id })),
    ...milestones.map(milestone => ({ value: `milestone:${milestone.id}`, label: `Milestone · ${milestone.title}`, searchText: milestone.title, artifactType: 'milestone' as const, artifactId: milestone.id })),
    ...goals.filter(goal => goal.id !== activeGoal?.id).map(goal => ({ value: `goal:${goal.id}`, label: `Goal · ${goal.title}`, searchText: goal.title, artifactType: 'goal' as const, artifactId: goal.id })),
  ];
  const supportingSourceOptions = tasks.flatMap(task => (task.attachments ?? []).map(attachment => {
    const extension = attachment.name.split('.').pop()?.toLowerCase() ?? '';
    const documentExtensions = new Set(['md', 'markdown', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'odt']);
    const artifactType: SupportingArtifactType = documentExtensions.has(extension) ? 'document' : 'file';
    return { value: `attachment:${task.id}:${attachment.id}`, label: `${artifactType === 'document' ? 'Document' : 'File'} · ${attachment.name}`, searchText: `${attachment.name} ${task.title}`, artifactType, artifactId: attachment.id, taskId: task.id, attachment };
  })).filter(option => option.artifactType === supportingArtifactType && option.searchText.toLocaleLowerCase().includes(supportingSourceSearch.trim().toLocaleLowerCase()));

  useEffect(() => {
    if (goals.length === 0) {
      if (selectedGoalId) setSelectedGoalId('');
      if (selectedElementId) setSelectedElementId('');
      return;
    }
    const nextGoal = goals.find(goal => goal.id === selectedGoalId) ?? goals[0];
    if (nextGoal.id !== selectedGoalId) setSelectedGoalId(nextGoal.id);
    if (!nextGoal.elements.some(element => element.id === selectedElementId)) setSelectedElementId(nextGoal.elements[0]?.id ?? '');
  }, [goals, selectedElementId, selectedGoalId]);
  useEffect(() => {
    if (!activeGoal || !canvasRef.current) return;
    const frame = requestAnimationFrame(() => {
      const nodes = Array.from(canvasRef.current?.querySelectorAll<HTMLElement>('[role="group"]') ?? []);
      const elements = activeGoal.elements.filter(element => element.type !== 'connector');
      setCanvasElementHeights(current => {
        let changed = false;
        const next = { ...current };
        nodes.forEach((node, index) => {
          const element = elements[index];
          if (!element) return;
          // Connector geometry is expressed in the canvas coordinate system. Use
          // the unscaled layout height so zoom cannot move the node endpoints.
          const height = node.offsetHeight;
          if (next[element.id] !== height) {
            next[element.id] = height;
            changed = true;
          }
        });
        return changed ? next : current;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeGoal, selectedElementId, zoom]);
  useEffect(() => {
    let cancelled = false;
    const storedImpacts = window.electron?.storeGet?.('omvra.goalPolicyImpacts.v1');
    void storedImpacts?.then(value => {
      if (cancelled) return;
      setPolicyImpacts(Array.isArray(value) ? value : []);
    });
    return () => { cancelled = true; };
  }, [workspacePolicy?.policyRevision]);
  useEffect(() => {
    let cancelled = false;
    if (!activeGoal) { setRuntimeProjection(null); return () => { cancelled = true; }; }
    void window.electron?.goals?.getRuntime?.(activeGoal.id).then(value => {
      if (!cancelled && value && typeof value === 'object') setRuntimeProjection(value as GoalRuntimeProjection);
    });
    return () => { cancelled = true; };
  }, [activeGoal?.id]);

  const getAgentForElement = (element: GoalElement) => element.type === 'agent'
    ? people.find(person => person.id === element.assigneeId)
    : undefined;

  const getElementTitle = (element: GoalElement) => getAgentForElement(element)?.name ?? element.title;
  const getElementBody = (element: GoalElement) => getAgentForElement(element)?.role ?? element.body;

  useEffect(() => {
    let cancelled = false;
    const refreshCanonicalGoals = () => getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null).then(stored => {
      if (cancelled || localMutationRef.current) return;
      if (Array.isArray(stored)) {
        const filtered = stored.filter(goal => goal.id !== GOAL_ID);
        canonicalGoalsRef.current = filtered;
        setGoals(filtered);
      }
    });
    void refreshCanonicalGoals().then(() => {
      setCanonicalHydrated(true);
    });
    window.addEventListener('focus', refreshCanonicalGoals);
    const unsubscribe = window.electron?.onStoreChanged?.(() => { if (!draggingRef.current && rendererWritesPendingRef.current === 0) void refreshCanonicalGoals(); });
    const unsubscribeRuntime = window.electron?.goals?.onRuntimeChanged?.((event) => {
      if (cancelled) return;
      if (event.goalId === activeGoal?.id) {
        void window.electron?.goals?.getRuntime?.(event.goalId).then(value => { if (!cancelled && value && typeof value === 'object') setRuntimeProjection(value as GoalRuntimeProjection); });
      }
      if (event.scope !== 'graph' || draggingRef.current || rendererWritesPendingRef.current > 0) return;
      const local = goalsRef.current.find(goal => goal.id === event.goalId);
      if (local && goalRevision(local) >= event.revision) return;
      void refreshCanonicalGoals();
    });
    return () => { cancelled = true; window.removeEventListener('focus', refreshCanonicalGoals); unsubscribe?.(); unsubscribeRuntime?.(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const refreshSchedules = () => getCanonicalJSON<unknown>(GOAL_SCHEDULES_STORAGE_KEY, null).then(value => {
      if (!cancelled && value !== null) setSchedules(normalizeGoalSchedules(value));
    });
    void refreshSchedules().then(() => {
      if (!cancelled) setSchedulesHydrated(true);
    });
    const unsubscribe = window.electron?.onStoreChanged?.(() => { if (!draggingRef.current && scheduleWritesPendingRef.current === 0) void refreshSchedules(); });
    return () => { cancelled = true; unsubscribe?.(); };
  }, []);
  useEffect(() => {
    if (!schedulesHydrated) return;
    const writeTimer = window.setTimeout(() => {
      scheduleWritesPendingRef.current += 1;
      void setCanonicalJSON(GOAL_SCHEDULES_STORAGE_KEY, schedules).finally(() => {
        scheduleWritesPendingRef.current = Math.max(0, scheduleWritesPendingRef.current - 1);
      });
    }, 120);
    return () => window.clearTimeout(writeTimer);
  }, [schedulesHydrated, schedules]);
  useEffect(() => {
    if (!canonicalHydrated || draggingRef.current) return;
    const writeTimer = window.setTimeout(() => {
      rendererWritesPendingRef.current += 1;
      canonicalWrite.current = canonicalWrite.current.then(async () => {
        const forceLocalWrite = localMutationRef.current;
        try {
          const canonical = await getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null);
          if (Array.isArray(canonical)) canonicalGoalsRef.current = canonical.filter(goal => goal.id !== GOAL_ID);
          const localRevision = Math.max(0, ...goals.map(goalRevision));
          const canonicalRevision = Array.isArray(canonical) ? Math.max(0, ...canonical.map(goalRevision)) : 0;
          const localChangedSinceSubmission = goalsRef.current.some(current => {
            const submitted = goals.find(goal => goal.id === current.id);
            return submitted && goalRevision(current) > goalRevision(submitted);
          });
          if (!forceLocalWrite && !draggingRef.current && !localChangedSinceSubmission && canonicalRevision > localRevision && Array.isArray(canonical)) {
            setGoals(canonical);
            return;
          }
          const previous = canonicalGoalsRef.current;
          const changed = goals.filter(goal => {
            const prior = previous.find(item => item.id === goal.id);
            return prior && JSON.stringify(prior) !== JSON.stringify(goal);
          });
          if (changed.length === 1 && previous.some(goal => goal.id === changed[0].id) && typeof window.electron?.goals?.update === 'function') {
            const goal = changed[0];
            const prior = previous.find(item => item.id === goal.id)!;
            const result = await window.electron.goals.update({ goalId: goal.id, title: goal.title, elements: goal.elements, overseerAgentId: goal.overseerAgentId, expectedRevision: goalRevision(prior) });
            if (result.ok && result.goal) {
              canonicalGoalsRef.current = previous.map(item => item.id === goal.id ? result.goal : item);
              if (!draggingRef.current) setGoals(current => {
                const local = current.find(item => item.id === goal.id);
                if (!local || goalRevision(local) > goalRevision(goal)) return current;
                return current.map(item => item.id === goal.id ? result.goal : item);
              });
              return;
            }
            if (!forceLocalWrite && result.error === 'REVISION_MISMATCH') {
              const fallback = await getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null);
              if (Array.isArray(fallback)) {
                canonicalGoalsRef.current = fallback;
                if (!draggingRef.current) setGoals(current => {
                  const local = current.find(item => item.id === goal.id);
                  if (local && goalRevision(local) > goalRevision(goal)) return current;
                  return fallback.filter(item => item.id !== GOAL_ID);
                });
              }
              return;
            }
          }
          const stored = await setCanonicalJSON(STORAGE_KEY, goals);
          if (!stored) {
            const fallback = await getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null);
            if (Array.isArray(fallback) && !forceLocalWrite && !draggingRef.current) setGoals(current => {
              if (current.some(item => {
                const submitted = goals.find(goal => goal.id === item.id);
                return submitted && goalRevision(item) > goalRevision(submitted);
              })) return current;
              return fallback;
            });
          }
        } finally {
          rendererWritesPendingRef.current = Math.max(0, rendererWritesPendingRef.current - 1);
          if (forceLocalWrite) localMutationRef.current = false;
        }
      });
    }, 120);
    return () => window.clearTimeout(writeTimer);
  }, [canonicalHydrated, goals]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        spaceHeldRef.current = false;
        setSpacePressed(false);
        panSessionRef.current = null;
        setPanMode(false);
        setConnectorMode(false);
        setConnectorSourceId(null);
        setConnectorSourceBranch(undefined);
        setRewireConnectorId(null);
        setAgentMenuOpen(false);
        setControlFlowMenuOpen(false);
        setArtifactMenuOpen(false);
        setNewGoalDialogOpen(false);
        return;
      }
      if (event.code !== 'Space') return;
      spaceHeldRef.current = true;
      setSpacePressed(true);
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest('input, textarea, select, [contenteditable="true"]')) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      spaceHeldRef.current = false;
      setSpacePressed(false);
    };
    const resetSpace = () => {
      spaceHeldRef.current = false;
      setSpacePressed(false);
      panSessionRef.current = null;
    };
    const visibility = () => { if (document.hidden) resetSpace(); };
    const closeMenus = (event: PointerEvent) => {
      if (!agentMenuRef.current?.contains(event.target as Node)) setAgentMenuOpen(false);
      if (!controlFlowMenuRef.current?.contains(event.target as Node)) setControlFlowMenuOpen(false);
      if (!artifactMenuRef.current?.contains(event.target as Node)) setArtifactMenuOpen(false);
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', resetSpace);
    window.addEventListener('pointerdown', closeMenus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', resetSpace);
      window.removeEventListener('pointerdown', closeMenus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (!drag) return;
    draggingRef.current = true;
    let frame = 0;
    let latestX = drag.startX;
    let latestY = drag.startY;
    const updatePosition = (clientX: number, clientY: number, finalize = false) => setGoals(current => current.map(goal => goal.id !== selectedGoalId ? goal : ({
      ...goal,
      ...(finalize ? { revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString() } : {}),
      elements: goal.elements.map(element => element.id !== drag.id ? element : { ...element, x: drag.originX + (clientX - drag.startX) / zoom, y: drag.originY + (clientY - drag.startY) / zoom }),
    })));
    const move = (event: PointerEvent) => {
      latestX = event.clientX;
      latestY = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updatePosition(latestX, latestY);
      });
    };
    const up = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      draggingRef.current = false;
      updatePosition(event.clientX, event.clientY, true);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      draggingRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag, selectedGoalId, zoom]);

  const updateElement = (updates: Partial<GoalElement>) => {
    if (selectedElementLocked) { setEditNotice('This node is locked while execution is active or committed. Pause, cancel, or amend the lifecycle before editing it.'); return; }
    setGoals(current => current.map(goal => goal.id !== selectedGoalId ? goal : ({ ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: goal.elements.map(element => element.id === selectedElement?.id ? { ...element, ...updates } : element) })));
  };
  const updateArtifactReferences = async (nextReferences: GoalArtifactReference[]) => {
    if (!activeGoal || !selectedElement || (selectedElement.type !== 'goal' && selectedElement.type !== 'subgoal' && selectedElement.type !== 'artifact')) return;
    const submittedRevision = goalRevision(activeGoal);
    const result = await window.electron?.goals?.updateArtifacts?.({ goalId: activeGoal.id, elementId: selectedElement.id, artifactReferences: nextReferences, expectedRevision: submittedRevision, idempotencyKey: createStableId('artifact-mutation') });
    if (!result?.ok || !result.goal) {
      setEditNotice(result?.message ?? 'Artifact links could not be updated. Refresh the Goal and try again.');
      return;
    }
    canonicalGoalsRef.current = canonicalGoalsRef.current.map(goal => goal.id === result.goal.id ? result.goal : goal);
    setGoals(current => {
      const local = current.find(goal => goal.id === result.goal.id);
      if (!local || goalRevision(local) > submittedRevision) return current;
      return current.map(goal => goal.id === result.goal.id ? result.goal : goal);
    });
  };
  const addCustomArtifactReference = () => {
    if (!selectedElement || selectedElement.type !== 'artifact' || !customArtifactLabel.trim()) return;
    void updateArtifactReferences([...selectedArtifactReferences, {
      id: createStableId('artifact-link'),
      artifactType: customArtifactKind === 'url' ? 'url' : customArtifactKind === 'file' ? 'file' : customArtifactKind === 'document' ? 'document' : 'user-defined',
      artifactId: createStableId('artifact'),
      contribution: 'supporting',
      label: customArtifactLabel.trim(),
      kind: customArtifactKind,
      format: customArtifactFormat.trim() || undefined,
      locator: customArtifactLocator.trim() || undefined,
      linkedBy: 'renderer',
      linkedAt: new Date().toISOString(),
    }]);
    setCustomArtifactLabel('');
    setCustomArtifactFormat('');
    setCustomArtifactLocator('');
  };
  const addSupportingSourceReference = (value: string) => {
    if (!selectedElement || selectedElement.type !== 'artifact') return;
    const option = supportingSourceOptions.find(item => item.value === value);
    if (!option || selectedArtifactReferences.some(reference => reference.sourceAttachmentId === option.attachment.id && reference.sourceTaskId === option.taskId)) return;
    void updateArtifactReferences([...selectedArtifactReferences, {
      id: createStableId('artifact-link'), artifactType: option.artifactType, artifactId: option.attachment.id,
      contribution: 'supporting', label: option.attachment.name, kind: option.artifactType,
      format: option.attachment.name.split('.').pop()?.toUpperCase() || undefined, locator: option.attachment.uri || option.attachment.path,
      sourceTaskId: option.taskId, sourceAttachmentId: option.attachment.id, linkedBy: 'renderer', linkedAt: new Date().toISOString(),
    }]);
  };
  const updateAgentConfiguration = (updates: Partial<GoalAgentConfiguration>) => {
    if (selectedElement?.type !== 'agent') return;
    const current = selectedElement.agentConfiguration ?? { version: 1 as const, mode: selectedElement.assigneeId ? 'existing' as const : 'ephemeral' as const, assigneeId: selectedElement.assigneeId, instructions: '' };
    const next = { ...current, ...updates, version: 1 as const };
    if (next.mode === 'ephemeral' && !next.requestedName && !next.autoGenerateName) next.requestedName = selectedAgent?.name ?? selectedElement.title;
    updateElement({ agentConfiguration: next, assigneeId: next.mode === 'existing' ? next.assigneeId : undefined });
  };
  const updateAgentName = (name: string) => {
    if (selectedElement?.type !== 'agent') return;
    const current = selectedElement.agentConfiguration ?? { version: 1 as const, mode: 'ephemeral' as const, instructions: '' };
    updateElement({ title: name, agentConfiguration: { ...current, version: 1 as const, requestedName: name } });
  };
  const updateGoal = (updates: Partial<GoalRecord>) => {
    if (selectedElementLocked) { setEditNotice('This Goal is locked while execution is active or committed. Pause, cancel, or amend the lifecycle before editing it.'); return; }
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, ...updates, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString() } : goal));
  };
  const createSchedule = () => {
    if (!activeGoal || activeSchedule) return;
    const schedule: GoalSchedule = {
      id: createStableId('schedule'),
      goalId: activeGoal.id,
      enabled: true,
      rule: { mode: 'one-time', date: new Date().toISOString().slice(0, 10), time: '09:00' },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      temporalMode: 'anchored',
      updatedAt: new Date().toISOString(),
    };
    setSchedules(current => [...current, schedule]);
  };
  const updateSchedule = (updates: Partial<GoalSchedule> | { rule: Partial<GoalSchedule['rule']> }) => {
    if (!activeGoal || !activeSchedule) return;
    setSchedules(current => current.map(schedule => {
      if (schedule.id !== activeSchedule.id) return schedule;
      const next = 'rule' in updates ? { ...schedule, rule: { ...schedule.rule, ...updates.rule } } : { ...schedule, ...updates };
      return { ...next, updatedAt: new Date().toISOString() };
    }));
  };
  const deleteSchedule = () => {
    if (!activeSchedule) return;
    setSchedules(current => current.filter(schedule => schedule.id !== activeSchedule.id));
  };
  const updatePolicy = (updates: Partial<GoalPolicy>) => {
    if (!selectedPolicyElement) return;
    const nextPolicy = { ...selectedPolicyElement.policy, ...updates };
    if (updates.retryBudgetMode === 'unbounded') delete nextPolicy.maxRetries;
    if (selectedPolicyElement.type === 'goal') updateGoal({ policy: nextPolicy });
    else updateElement({ policy: nextPolicy });
  };
  const updatePolicyDimension = (dimension: GoalPolicyDimension, updates: GoalPolicyDimensionOverride | undefined) => {
    const dimensions = { ...selectedPolicyElement?.policy?.dimensions };
    if (updates) dimensions[dimension] = updates;
    else delete dimensions[dimension];
    updatePolicy({ dimensions });
  };
  const addElement = (type: GoalElementType) => {
    if (!activeGoal) return;
    const id = createStableId(type === 'connector' ? 'connector' : 'element');
    const title = type === 'subgoal' ? 'New subgoal' : type === 'condition' ? 'New condition' : type === 'approval-gate' ? 'Approval gate' : type === 'human-input' ? 'Ask the user' : type === 'retry' ? 'Retry an earlier step' : type === 'deliverable' ? 'New deliverable' : type === 'artifact' ? 'Supporting artifact' : `New ${type}`;
    const body = type === 'condition' ? 'Define the condition to evaluate' : type === 'approval-gate' ? 'Define who must approve and what evidence is required' : type === 'human-input' ? 'Pause for overseer-mediated user input' : type === 'retry' ? 'Return to an earlier completed workflow step' : type === 'deliverable' ? 'Define the expected outcome and delivery handoff' : type === 'artifact' ? 'Declare an execution input or supporting file' : 'Describe the outcome and handoff';
    const element: GoalElement = {
      id, type, title, body, x: 260 + (activeGoal.elements.length % 3) * 260, y: 560,
      width: 220, height: type === 'human-input' ? 120 : 90, status: 'draft',
      ...(type === 'human-input' ? { humanInputPrompt: 'What input is needed to continue?' } : {}),
      ...(type === 'retry' ? { retryMaxAttempts: 3, retryExhaustionPolicy: 'human-review' } : {}),
      ...(type === 'deliverable' ? { deliverableStatus: 'planned', deliverySpec: { outcomeKind: 'other' as const, instructions: '', acceptanceCriteria: [] } } : {}),
      ...(type === 'artifact' ? { artifactRole: 'supporting' as const, artifactReferences: [] } : {}),
    };
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: [...goal.elements, element] } : goal));
    setSelectedElementId(id);
  };
  const deleteElement = () => {
    if (!selectedElement) return;
    if (selectedElementLocked) { setEditNotice('This node cannot be deleted during active or committed execution.'); return; }
    if (selectedElement.type === 'goal') {
      setDeleteDialogOpen(true);
      return;
    }
    performDeleteElement();
  };
  const performDeleteElement = () => {
    if (!selectedElement) return;
    if (selectedElement.type === 'goal') {
      localMutationRef.current = true;
      const remainingGoals = goals.filter(goal => goal.id !== selectedGoalId);
      setGoals(remainingGoals);
      const nextGoal = remainingGoals[0];
      setSelectedGoalId(nextGoal?.id ?? '');
      setSelectedElementId(nextGoal?.elements[0]?.id ?? '');
      setDeleteDialogOpen(false);
      return;
    }
      setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: goal.elements.filter(element => element.id !== selectedElement.id && element.sourceId !== selectedElement.id && element.targetId !== selectedElement.id) } : goal));
    setSelectedElementId(activeGoal.elements.find(element => element.id !== selectedElement.id)?.id ?? '');
  };
  useEffect(() => {
    const onDeleteKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (!selectedElement) return;
      event.preventDefault();
      deleteElement();
    };
    window.addEventListener('keydown', onDeleteKey);
    return () => window.removeEventListener('keydown', onDeleteKey);
  }, [activeGoal, deleteElement, selectedElement]);
  const openNewGoalDialog = () => {
    setNewGoalTitle('');
    setNewGoalBody('');
    setNewGoalDialogOpen(true);
  };
  const createGoal = () => {
    const title = newGoalTitle.trim() || 'Untitled goal';
    const goal: GoalRecord = { id: createStableId('goal'), title, color: '#2563eb', updatedAt: new Date().toISOString(), elements: [{ id: createStableId('element'), type: 'goal', title, body: newGoalBody.trim() || 'Define the outcome', x: 420, y: 180, width: 250, height: 104, status: 'draft' }] };
    setGoals(current => [...current, goal]); setSelectedGoalId(goal.id); setSelectedElementId(goal.elements[0].id); setNewGoalDialogOpen(false);
  };

  const addTemplate = (template: GoalTemplate) => {
    const goal = instantiateGoalTemplate(template, createStableId);
    setGoals(current => [...current, goal]);
    setSelectedGoalId(goal.id);
    setSelectedElementId(goal.elements.find(element => element.type === 'goal')?.id ?? goal.elements[0]?.id ?? '');
  };

  const connections = activeGoal?.elements.filter(element => element.type === 'connector') ?? [];
  const selectedConnections = selectedElement?.type !== 'connector'
    ? connections.filter(connection => connection.sourceId === selectedElement?.id || connection.targetId === selectedElement?.id)
    : [];

  const canvasElementHeight = (element: GoalElement) => canvasElementHeights[element.id]
    ?? (element.type === 'condition' ? Math.max(element.height ?? 90, 150) : element.type === 'human-input' ? Math.max(element.height ?? 90, 120) : element.height ?? 90);

  const moveCanvasSelection = (elementId: string, forward: boolean) => {
    const items = activeGoal?.elements ?? [];
    const index = items.findIndex(element => element.id === elementId);
    if (index < 0) return;
    const nextIndex = forward ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);
    const nextId = items[nextIndex]?.id ?? elementId;
    setSelectedElementId(nextId);
    requestAnimationFrame(() => document.getElementById(`goal-canvas-item-${nextId}`)?.focus());
  };


  const addAgent = (person: Person) => {
    if (!activeGoal) return;
    const id = createStableId('element');
    const element: GoalElement = { id, type: 'agent', title: person.name, body: person.role, assigneeId: person.id, agentConfiguration: { version: 1, mode: 'existing', assigneeId: person.id, instructions: '' }, x: 260 + (activeGoal.elements.length % 3) * 260, y: 560, width: 220, height: 90, status: 'draft' };
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: [...goal.elements, element] } : goal));
    setSelectedElementId(id);
    setAgentMenuOpen(false);
    setArtifactMenuOpen(false);
  };

  const deleteConnection = (connectionId: string) => {
    const connection = activeGoal?.elements.find(element => element.id === connectionId);
    const source = activeGoal?.elements.find(element => element.id === connection?.sourceId);
    const target = activeGoal?.elements.find(element => element.id === connection?.targetId);
    if (isExecutionLocked(connection) || isExecutionLocked(source) || isExecutionLocked(target)) { setEditNotice('This connection participates in active or committed execution and cannot be changed.'); return; }
    setGoals(current => current.map(goal => goal.id === selectedGoalId
      ? { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: goal.elements.filter(element => element.id !== connectionId) }
      : goal));
    if (selectedElement?.id === connectionId) setSelectedElementId(activeGoal?.elements.find(element => element.id !== connectionId)?.id ?? '');
  };

  const connectNodes = (targetId: string, targetSide: GoalConnectorSide = 'left') => {
    if (!connectorSourceId) return;
    if (connectorSourceId === targetId) {
      setConnectorError('A connector needs two different nodes.');
      return;
    }
    if (!activeGoal?.elements.some(element => element.id === connectorSourceId && element.type !== 'connector') || !activeGoal.elements.some(element => element.id === targetId && element.type !== 'connector')) {
      setConnectorError('Both connector endpoints must be valid nodes.');
      return;
    }
    const source = activeGoal.elements.find(element => element.id === connectorSourceId);
    const target = activeGoal.elements.find(element => element.id === targetId);
    if (isExecutionLocked(source) || isExecutionLocked(target)) {
      setConnectorError('Active or committed nodes cannot be rewired. Pause, cancel, or amend the lifecycle first.');
      return;
    }
    if (source?.type === 'retry' && !isValidRetryTarget(activeGoal.elements, source.id, targetId, rewireConnectorId)) {
      setConnectorError('A retry must target an earlier connected workflow step.');
      return;
    }
    if (source?.type === 'retry' && activeGoal.elements.some(element => element.type === 'connector' && element.id !== rewireConnectorId && element.sourceId === source.id)) {
      setConnectorError('A retry node can target one earlier workflow step. Rewire its existing connector instead.');
      return;
    }
    if (source?.type !== 'retry' && wouldCreateGoalCycle(activeGoal.elements, connectorSourceId, targetId, rewireConnectorId)) {
      setConnectorError('That connection would create a cycle.');
      return;
    }
    setGoals(current => current.map(goal => {
      if (goal.id !== selectedGoalId) return goal;
      const elements = rewireConnectorId
        ? goal.elements.map(element => element.id === rewireConnectorId ? { ...element, sourceId: connectorSourceId, targetId, sourceSide: element.sourceSide ?? connectorSourceSide, targetSide, conditionBranch: connectorSourceBranch } : element)
        : [...goal.elements, { id: createStableId('connector'), type: 'connector' as const, title: 'Node connection', x: 0, y: 0, sourceId: connectorSourceId, targetId, sourceSide: connectorSourceSide, targetSide, conditionBranch: connectorSourceBranch }];
      return { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements };
    }));
    setConnectorMode(false);
    setConnectorSourceId(null);
    setConnectorSourceBranch(undefined);
    setRewireConnectorId(null);
    setConnectorError(null);
  };

  const nodePoint = (element: GoalElement, side: GoalConnectorSide, branch?: GoalConditionBranch) => {
    const width = element.width ?? 220;
    const height = canvasElementHeight(element);
    if (side === 'top') return { x: element.x + width / 2, y: element.y };
    if (side === 'bottom') return { x: element.x + width / 2, y: element.y + height };
    if (side === 'left') return { x: element.x, y: element.y + height / 2 };
    if (element.type === 'condition' && branch) return { x: element.x + width, y: element.y + height * (branch === 'positive' ? 0.32 : 0.68) };
    return { x: element.x + width, y: element.y + height / 2 };
  };

  const controlPoint = (point: { x: number; y: number }, side: GoalConnectorSide, distance: number) => {
    if (side === 'top') return { x: point.x, y: point.y - distance };
    if (side === 'bottom') return { x: point.x, y: point.y + distance };
    if (side === 'left') return { x: point.x - distance, y: point.y };
    return { x: point.x + distance, y: point.y };
  };

  const connectorPath = (connection: GoalElement) => {
    const source = activeGoal?.elements.find(element => element.id === connection.sourceId);
    const target = activeGoal?.elements.find(element => element.id === connection.targetId);
    if (!source || !target) return null;
    const sourceSide = connection.sourceSide ?? 'right';
    const targetSide = connection.targetSide ?? 'left';
    const start = nodePoint(source, sourceSide, connection.conditionBranch);
    const end = nodePoint(target, targetSide);
    const bend = Math.max(48, Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) * 0.35);
    const first = controlPoint(start, sourceSide, bend);
    const second = controlPoint(end, targetSide, bend);
    return `M ${start.x} ${start.y} C ${first.x} ${first.y}, ${second.x} ${second.y}, ${end.x} ${end.y}`;
  };

  const beginConnection = (elementId: string, side: GoalConnectorSide, branch?: GoalConditionBranch) => {
    if (isExecutionLocked(activeGoal?.elements.find(element => element.id === elementId))) {
      setConnectorError('Active or committed nodes cannot be rewired. Pause, cancel, or amend the lifecycle first.');
      return;
    }
    setConnectorMode(true);
    setConnectorSourceId(elementId);
    setConnectorSourceSide(side);
    setConnectorSourceBranch(branch);
    setConnectorError(null);
  };

  const portStyle = (side: GoalConnectorSide): CSSProperties => {
    if (side === 'top') return { left: '50%', top: '-0.5rem', transform: 'translateX(-50%)' };
    if (side === 'right') return { right: '-0.5rem', top: '50%', transform: 'translateY(-50%)' };
    if (side === 'bottom') return { left: '50%', bottom: '-0.5rem', transform: 'translateX(-50%)' };
    return { left: '-0.5rem', top: '50%', transform: 'translateY(-50%)' };
  };

  const beginCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    setAgentMenuOpen(false);
    setArtifactMenuOpen(false);
    if ((!spaceHeldRef.current && !panMode) || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const moveCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    setPan({
      x: session.originX + event.clientX - session.startX,
      y: session.originY + event.clientY - session.startY,
    });
  };

  const endCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    panSessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const renderPorts = (element: GoalElement) => {
    const sides = (['top', 'right', 'bottom', 'left'] as GoalConnectorSide[]).filter(side => element.type !== 'condition' || side !== 'right');
    return <>{sides.map(side => (
      <button key={side} type="button" style={portStyle(side)} className={`absolute size-4 rounded-full border-2 border-white shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceSide === side ? 'bg-amber-400' : 'bg-blue-400'}`} onPointerDown={event => { if (!spaceHeldRef.current && !panMode) event.stopPropagation(); }} onClick={event => { event.stopPropagation(); if (connectorMode && connectorSourceId) connectNodes(element.id, side); else beginConnection(element.id, side); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${element.title} via ${side} handle`} />
    ))}{element.type === 'condition' && <><button type="button" style={{ right: '-0.5rem', top: '32%', transform: 'translateY(-50%)' }} className={`absolute size-4 rounded-full border-2 border-white bg-emerald-400 shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceBranch === 'positive' ? 'ring-2 ring-amber-400' : ''}`} onPointerDown={event => { if (!spaceHeldRef.current && !panMode) event.stopPropagation(); }} onClick={event => { event.stopPropagation(); if (connectorMode && connectorSourceId) connectNodes(element.id, 'right'); else beginConnection(element.id, 'right', 'positive'); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${conditionPositiveLabel(element)} branch`} /><button type="button" style={{ right: '-0.5rem', top: '68%', transform: 'translateY(-50%)' }} className={`absolute size-4 rounded-full border-2 border-white bg-rose-400 shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceBranch === 'negative' ? 'ring-2 ring-amber-400' : ''}`} onPointerDown={event => { if (!spaceHeldRef.current && !panMode) event.stopPropagation(); }} onClick={event => { event.stopPropagation(); if (connectorMode && connectorSourceId) connectNodes(element.id, 'right'); else beginConnection(element.id, 'right', 'negative'); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${conditionNegativeLabel(element)} branch`} /></>}</>;
  };

  return (
  <section className="goals-view relative h-full min-h-0 overflow-hidden bg-slate-50 text-slate-700">
    <aside className={`absolute left-4 top-4 bottom-4 z-20 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-[width] duration-200 ${leftPanelCollapsed ? 'w-12' : 'w-64'}`}>
      <div className={`flex items-center border-b px-3 py-3 ${leftPanelCollapsed ? 'justify-center' : 'justify-between'}`}><div className={leftPanelCollapsed ? 'hidden' : ''}><h1 className="text-sm font-semibold text-slate-900">Goals</h1><p className="mt-0.5 text-xs text-slate-500">Shape work as a loop</p></div><button onClick={() => setLeftPanelCollapsed(value => !value)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={leftPanelCollapsed ? 'Expand goals panel' : 'Collapse goals panel'}>{leftPanelCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}</button></div>
      <div className={`flex-1 space-y-1 overflow-auto p-2 ${leftPanelCollapsed ? 'hidden' : ''}`}>{goals.map(goal => { const goalStatus = goal.elements.find(element => element.type === 'goal')?.status ?? 'draft'; return <button key={goal.id} onClick={() => { setSelectedGoalId(goal.id); setSelectedElementId(goal.elements[0]?.id ?? ''); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${goal.id === selectedGoalId ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><span className="block truncate">{goal.title}</span><span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400"><span>{goal.elements.filter(element => element.type === 'subgoal').length} subgoals · {goal.elements.length} nodes</span><span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium ${compactChipClass(statusChipClass(goalStatus))}`}><StatusIcon status={goalStatus} className="size-3" />{statusLabel(goalStatus)}</span></span></button>; })}</div>
      <div className={`flex-1 flex-col items-center gap-2 overflow-auto p-2 ${leftPanelCollapsed ? 'flex' : 'hidden'}`}>{goals.map(goal => <button key={goal.id} onClick={() => { setSelectedGoalId(goal.id); setSelectedElementId(goal.elements[0]?.id ?? ''); }} className={`rounded-lg p-2 ${goal.id === selectedGoalId ? 'bg-slate-100' : 'hover:bg-slate-50'}`} aria-label={goal.title} title={goal.title}><Sparkles className="size-4" style={{ color: goal.color ?? '#2563eb' }} /></button>)}</div>
      <div className={`border-t p-3 ${leftPanelCollapsed ? 'hidden' : ''}`}><button onClick={openNewGoalDialog} className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"><Plus className="size-3.5" /> New goal</button></div>
    </aside>

    <div className="absolute left-1/2 top-4 z-20 flex w-fit h-fit shrink -translate-x-1/2 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
    <GoalTemplatesPopover templates={GOAL_TEMPLATES} onSelect={addTemplate} />
    <div ref={controlFlowMenuRef} className="relative w-fit h-fit shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <button disabled={!activeGoal} onClick={() => setControlFlowMenuOpen(value => !value)} className="relative flex w-fit h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Add control flow" aria-haspopup="menu" aria-expanded={controlFlowMenuOpen}>
            <span className="flex items-center justify-center"><WorkflowsIcon className="size-3.5 text-[#71717a]" /></span>
            <DropdownChevron />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>Add control flow</TooltipContent>
      </Tooltip>
      {controlFlowMenuOpen && activeGoal && <div role="menu" aria-label="Add control flow" className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {CONTROL_FLOW_ITEMS.map(item => <button key={item.type} role="menuitem" onClick={() => { addElement(item.type); setControlFlowMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-slate-100">
          <span className="text-slate-600">{item.icon}</span><span><span className="block font-medium text-slate-800">{item.label}</span><span className="block text-[11px] text-slate-400">{item.type === 'human-input' ? 'Pause for user input' : 'Return to an earlier step'}</span></span>
        </button>)}
      </div>}
    </div>
    <div ref={artifactMenuRef} className="relative w-fit h-fit shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" disabled={!activeGoal} onClick={() => setArtifactMenuOpen(value => !value)} className="relative flex w-fit h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Add artifact">
            <span className="flex items-center justify-center"><AwardCertificateIcon className="size-3.5 text-[#71717a]" /></span>
            <DropdownChevron />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>Add artifact</TooltipContent>
      </Tooltip>
      {artifactMenuOpen && activeGoal && <div role="menu" aria-label="Add artifact" className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {ARTIFACT_ITEMS.map(item => <button key={item.type} role="menuitem" onClick={() => { addElement(item.type); setArtifactMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-slate-100">
          <span className="text-slate-600">{item.icon}</span><span><span className="block font-medium text-slate-800">{item.label}</span><span className="block text-[11px] text-slate-400">{item.description}</span></span>
        </button>)}
      </div>}
    </div>
    {TOOL_ITEMS.map(tool => tool.type === 'agent' ?
      <div key={tool.type} ref={agentMenuRef} className="relative w-fit h-fit shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button disabled={!activeGoal} onClick={() => setAgentMenuOpen(value => !value)} className="relative flex w-fit h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Add agent" aria-haspopup="menu" aria-expanded={agentMenuOpen}>
              <span className="flex items-center justify-center">{tool.icon}</span>
              <DropdownChevron />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>Add {tool.label}</TooltipContent>
          </Tooltip>
            {agentMenuOpen && activeGoal &&
            <div role="menu" aria-label="Add agent" className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              {people.filter(person => person.kind === 'agentic').map(person =>
                <button key={person.id} role="menuitem" onClick={() => addAgent(person)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-slate-100">
                  <Bot className="size-3.5 text-amber-500" />
                  <span>
                    <span className="block font-medium text-slate-800">{person.name}</span>
                    <span className="block text-[11px] text-slate-400">{person.role}</span>
                  </span>
                </button>)}
                  {people.filter(person => person.kind === 'agentic').length === 0 &&
                  <p className="px-2.5 py-2 text-xs text-slate-400">No agents configured</p>}
                  </div>}
                  </div> : <Tooltip key={tool.type}>
                    <TooltipTrigger asChild>
                      <button disabled={!activeGoal} onClick={() => tool.type === 'connector' ? (setConnectorMode(true), setConnectorSourceId(null), setConnectorSourceBranch(undefined)) : addElement(tool.type)} className={`flex size-8 shrink-0 items-center justify-center rounded-full p-0 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${tool.type === 'connector' && connectorMode ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`} aria-label={`Add ${tool.label}`}>{tool.icon}</button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={4}>{tool.type === 'connector' && connectorMode ? 'Choose source' : `Add ${tool.label}`}</TooltipContent></Tooltip>)}</div>

    <div ref={canvasRef} tabIndex={0} role="application" aria-label="Goal canvas. Hold space and drag to pan." className={`h-full w-full outline-none ${spacePressed || panMode ? 'cursor-grab' : 'cursor-default'}`} onPointerDown={beginCanvasPan} onPointerMove={moveCanvasPan} onPointerUp={endCanvasPan} onPointerCancel={endCanvasPan} onLostPointerCapture={event => { if (panSessionRef.current?.pointerId === event.pointerId) panSessionRef.current = null; }}>
      <div className="goals-canvas-grid absolute inset-0" aria-hidden="true" />
      {!activeGoal && <div className="absolute inset-0 flex items-center justify-center p-6" role="status" aria-live="polite"><div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm"><div className="mx-auto flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Sparkles className="size-5" /></div><h2 className="mt-3 text-sm font-semibold text-slate-900">Start with a Goal</h2><p className="mt-1 text-xs leading-5 text-slate-500">Create a Goal to shape its subgoals, agents, instructions, and approval gates on the canvas.</p><button type="button" onClick={openNewGoalDialog} className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"><Plus className="size-3.5" /> New goal</button></div></div>}
      <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`, transformOrigin: 'center' }}>
        <svg className="pointer-events-auto absolute left-0 top-0 h-[1200px] w-[2000px] overflow-visible"><defs>{connections.map(connection => <linearGradient key={connection.id} id={`connector-gradient-${connection.id}`} x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stopColor={connection.conditionBranch === 'positive' ? '#34d399' : '#fb7185'} /><stop offset="100%" stopColor="#60a5fa" /></linearGradient>)}</defs>{connections.map(connection => { const path = connectorPath(connection); const branchLabel = connection.conditionBranch ? ` via ${connection.conditionBranch} branch` : ''; const source = activeGoal?.elements.find(element => element.id === connection.sourceId); const isRetryReturn = source?.type === 'retry'; return path ? <path key={connection.id} id={`goal-canvas-item-${connection.id}`} d={path} fill="none" stroke={connection.conditionBranch ? `url(#connector-gradient-${connection.id})` : isRetryReturn ? '#0891b2' : selectedElement?.id === connection.id ? '#2563eb' : '#94a3b8'} strokeWidth={selectedElement?.id === connection.id ? '3' : '2'} strokeDasharray={isRetryReturn ? '7 5' : undefined} strokeLinecap="round" className="cursor-pointer outline-none focus-visible:stroke-blue-600" onClick={event => { event.stopPropagation(); setSelectedElementId(connection.id); setConnectorMode(false); setConnectorSourceId(null); setConnectorSourceBranch(undefined); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedElementId(connection.id); } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveCanvasSelection(connection.id, event.key === 'ArrowRight' || event.key === 'ArrowDown'); } }} role="button" tabIndex={selectedElement?.id === connection.id ? 0 : -1} aria-label={`${isRetryReturn ? 'Retry return' : 'Connector'} from ${connection.sourceId} to ${connection.targetId}${branchLabel}`} /> : null; })}</svg>
        {connectorError && <div role="alert" className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 shadow-sm">{connectorError}</div>}
        {activeGoal?.elements.filter(element => element.type !== 'connector').map(element => { const connected = isGoalElementConnected(activeGoal.elements, element.id); const locked = isExecutionLocked(element); const readiness = readinessForElement(element, connected); const readinessDisplay = readiness === 'ready' ? <span className="mt-3 inline-flex items-center" title="Ready for workflow use"><ReadyIcon /></span> : <span className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${readinessChipClass(readiness)}`}><CircleDot className="size-3" />{readinessLabel(readiness)}</span>; return <div key={element.id} id={`goal-canvas-item-${element.id}`} role="group" aria-label={`${element.type}: ${getElementTitle(element)}`} tabIndex={selectedElement?.id === element.id ? 0 : -1} onClick={() => { if (connectorMode) { if (connectorSourceId) connectNodes(element.id); else beginConnection(element.id, 'right'); } else setSelectedElementId(element.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedElementId(element.id); } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveCanvasSelection(element.id, event.key === 'ArrowRight' || event.key === 'ArrowDown'); } }} onPointerDown={event => { if (spaceHeldRef.current || panMode || connectorMode || locked) return; setSelectedElementId(element.id); setDrag({ id: element.id, startX: event.clientX, startY: event.clientY, originX: element.x, originY: element.y }); }} className={`absolute flex flex-col rounded-lg border p-3 text-left shadow-sm transition-shadow hover:shadow-md ${nodeClass(element.type, connected)} ${locked ? 'cursor-not-allowed' : ''} ${selectedElement?.id === element.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`} style={{ left: element.x, top: element.y, width: element.width ?? 220, height: canvasElementHeight(element) }}><span className="flex min-w-0 items-center gap-2 text-xs font-semibold"><span className="rounded bg-black/5 p-1">{elementIcon(element.type)}</span><span className="truncate">{getElementTitle(element)}</span></span>{getElementBody(element) && <span className={`mt-2 line-clamp-2 text-[11px] ${element.type === 'goal' ? 'text-slate-300' : 'text-slate-500'}`}>{getElementBody(element)}</span>}{element.type === 'condition' && <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{conditionPositiveLabel(element)}</span><span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-700">{conditionNegativeLabel(element)}</span></div>}{element.type === 'retry' && <span className="mt-2 inline-flex w-fit items-center gap-1 text-[10px] font-semibold text-cyan-700"><RotateCcw className="size-3" />Max {element.retryMaxAttempts ?? '—'} attempts</span>}{isCompletionElement(element) ? <span className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${compactChipClass(statusChipClass(element.status))}`}><StatusIcon status={element.status} />{statusLabel(element.status)}</span> : readinessDisplay}{locked && <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 shadow-sm" title={element.status === 'working' ? 'In progress — editing locked' : 'Editing locked'}>{element.status === 'working' ? <LoaderCircle aria-hidden="true" className="size-3 animate-spin" /> : <LockKeyhole aria-hidden="true" className="size-3" />}</span>}{renderPorts(element)}</div>; })}
      </div>
    </div>
    {editNotice && <div role="status" className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm"><LockKeyhole className="size-3.5 shrink-0" />{editNotice}<button type="button" className="ml-1 font-semibold text-amber-900" onClick={() => setEditNotice(null)}>Dismiss</button></div>}

    {selectedElement && (
      <aside className="absolute bottom-16 right-4 top-16 z-20 w-72 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase text-slate-400">Details</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">{selectedElement.type}</h2>
          </div>
        </div>
        {selectedElementLocked && <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" /><span>{selectedElement.status === 'working' ? 'This node is already in progress. Its structure and execution contract are locked.' : 'This node is committed to execution and cannot be edited here.'}</span></div>}
        <fieldset disabled={selectedElementLocked} className="contents">
        <label className="mt-5 block text-xs font-medium text-slate-600">
          {selectedElement.type === 'agent' ? 'Name' : 'Title'}
          <Input
            value={selectedElement.type === 'agent' ? selectedAgent?.name ?? (selectedAgentConfiguration?.autoGenerateName ? '' : selectedAgentConfiguration?.requestedName ?? selectedElement.title) : selectedElement.title}
            placeholder={selectedElement.type === 'agent' && selectedAgentConfiguration?.autoGenerateName ? 'Generated at spawn' : undefined}
            readOnly={selectedElement.type === 'agent' && (selectedAgentMode === 'existing' || selectedAgentConfiguration?.autoGenerateName === true)}
            onChange={selectedElement.type === 'agent' ? event => updateAgentName(event.target.value) : event => updateElement({ title: event.target.value })}
            className="mt-1"
          />
          {selectedElement.type === 'agent' && selectedAgentMode === 'ephemeral' && <span className="mt-1 block text-[11px] font-normal text-slate-400">{selectedAgentConfiguration?.autoGenerateName ? 'The overseer will generate a name when this agent is spawned.' : 'Required task-focused name.'}</span>}
          {selectedAgentMissing && <span role="alert" className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-normal text-amber-800"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Assign a canonical agent before this node can be started or dispatched.</span>}
        </label>
        {selectedElement.type === 'goal' && (
          <>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Color
              <input
                type="color"
                value={activeGoal?.color ?? '#2563eb'}
                onChange={event => updateGoal({ color: event.target.value })}
                aria-label="Goal color"
                className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-1"
              />
            </label>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Overseer agent
              <Select value={activeGoal?.overseerAgentId ?? '__none__'} onValueChange={value => updateGoal({ overseerAgentId: value === '__none__' ? undefined : value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select an agent</SelectItem>
                  {people.filter(person => person.kind === 'agentic').map(person => (
                    <SelectItem key={person.id} value={person.id}>{person.name} · {person.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="mt-1 block text-[11px] font-normal text-slate-400">This agent derives subgoal status toward the goal.</span>
            </label>
          </>
        )}
        {selectedElement.type !== 'agent' && <label className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs font-medium text-slate-600">
          Notes
          <textarea value={selectedElement.body ?? ''} onChange={event => updateElement({ body: event.target.value })} rows={4} className="mt-1 w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </label>}
        {selectedElement.type === 'agent' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Task instructions</p>
            <label className="mt-3 block text-sm font-medium text-slate-700">What this agent must do
              <textarea value={selectedAgentConfiguration?.instructions ?? ''} onChange={event => updateAgentConfiguration({ instructions: event.target.value })} rows={8} autoFocus={false} placeholder="Describe the concrete work, scope, and expected result for this agent node." className="mt-1 w-full resize-y rounded-md border border-blue-200 bg-blue-50/30 px-3 py-2.5 text-sm leading-5 text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </label>
            <p className="mt-2 text-[11px] text-slate-400">These instructions are sent with the delegation contract. They are separate from the node label and canonical agent profile.</p>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Agent setup</p>
              <label className="mt-3 block text-xs font-medium text-slate-600">Agent mode
              <Select value={selectedAgentMode} onValueChange={value => updateAgentConfiguration({ mode: value as GoalAgentMode, ...(value === 'existing' ? { requestedName: undefined, requestedType: undefined } : { assigneeId: undefined }) })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="existing">Existing canonical agent</SelectItem><SelectItem value="ephemeral">Ephemeral temporary agent</SelectItem></SelectContent>
              </Select>
              </label>
            {selectedAgentMode === 'existing' ? <>
              <label className="mt-3 block text-xs font-medium text-slate-600">Canonical agent
                <Select value={selectedAgentConfiguration?.assigneeId ?? selectedElement.assigneeId ?? '__none__'} onValueChange={value => updateAgentConfiguration({ assigneeId: value === '__none__' ? undefined : value })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select an agent" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">Select an agent</SelectItem>{people.filter(person => person.kind === 'agentic').map(person => <SelectItem key={person.id} value={person.id}>{person.name} · {person.role}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              {selectedAgent && <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">Canonical profile is applied at dispatch: {selectedAgent.agentInstructions ? 'persona' : 'no persona'} + {selectedAgent.agentOperationalInstructions ? 'operational guidance' : 'no operational guidance'}.</p>}
              <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={selectedAgentConfiguration?.spawnIfUnavailable === true} onChange={event => updateAgentConfiguration({ spawnIfUnavailable: event.target.checked })} /> Recruit temporarily if unavailable</label>
            </> : <>
              <label className="mt-3 flex items-start gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={selectedAgentConfiguration?.autoGenerateName === true} onChange={event => updateAgentConfiguration({ autoGenerateName: event.target.checked, ...(event.target.checked ? { requestedName: undefined } : {}) })} className="mt-0.5" /> <span>Generate name at spawn<span className="mt-1 block text-[11px] font-normal text-slate-400">Use this when the role is more important than a fixed name.</span></span></label>
              <label className="mt-3 block text-xs font-medium text-slate-600">Requested capability / type<Input value={selectedAgentConfiguration?.requestedType ?? ''} onChange={event => updateAgentConfiguration({ requestedType: event.target.value || undefined })} className="mt-1" placeholder="e.g. accessibility researcher" /></label>
            </>}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Ephemeral agents receive only the requested capability and these task instructions; existing agents additionally receive their canonical profile.</p>
          </section>
        )}
        {selectedElement.type === 'human-input' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Human input</p>
            <label className="mt-3 block text-xs font-medium text-slate-600">Prompt for the user<textarea value={selectedElement.humanInputPrompt ?? ''} onChange={event => updateElement({ humanInputPrompt: event.target.value })} rows={4} placeholder="What should the overseer ask the user?" className="mt-1 w-full resize-y rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
            <p className="mt-2 text-[11px] text-slate-400">The overseer will pause this workflow and persist the user's response before resuming.</p>
          </section>
        )}
        {selectedElement.type === 'retry' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Retry control</p>
            <label className="mt-3 block text-xs font-medium text-slate-600">Maximum attempts
              <Input type="number" min={1} step={1} value={selectedElement.retryMaxAttempts ?? ''} onChange={event => { const value = Number(event.target.value); updateElement({ retryMaxAttempts: Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined }); }} className="mt-1" aria-describedby="retry-attempts-help" />
              <span id="retry-attempts-help" className="mt-1 block text-[11px] font-normal text-slate-400">Counts retries for the current execution. The return target is configured with a regular connector.</span>
            </label>
            <label className="mt-3 block text-xs font-medium text-slate-600">When attempts are exhausted
              <Select value={selectedElement.retryExhaustionPolicy ?? 'human-review'} onValueChange={value => updateElement({ retryExhaustionPolicy: value as GoalRetryExhaustionPolicy })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="human-review">Require human review</SelectItem><SelectItem value="fail-goal">Fail the Goal</SelectItem></SelectContent>
              </Select>
            </label>
            <div className="mt-3 rounded-md border border-cyan-100 bg-cyan-50/60 px-2.5 py-2 text-[11px] text-cyan-800"><span className="font-semibold">Retry target:</span> {selectedRetryTarget ? activeGoal?.elements.find(element => element.id === selectedRetryTarget)?.title ?? 'Missing node' : 'Connect this node to an earlier step.'}</div>
          </section>
        )}
        {selectedElement.type === 'deliverable' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Delivery contract</p>
            <p className="mt-1 text-[11px] text-slate-400">These instructions are authoritative for this Goal revision. Notes provide context only.</p>
            <label className="mt-3 block text-xs font-medium text-slate-600">Outcome kind
              <Select value={selectedElement.deliverySpec?.outcomeKind ?? 'other'} onValueChange={value => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { instructions: '' }), outcomeKind: value as NonNullable<GoalElement['deliverySpec']>['outcomeKind'] } })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="file">File</SelectItem><SelectItem value="summary">Summary</SelectItem><SelectItem value="conclusion">Conclusion</SelectItem><SelectItem value="resolution">Resolution</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
              </Select>
            </label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Delivery instructions<textarea value={selectedElement.deliverySpec?.instructions ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other' }), instructions: event.target.value } })} rows={5} placeholder="Describe how this outcome should be delivered, where, and in what form." className="mt-1 w-full resize-y rounded-md border border-emerald-200 bg-emerald-50/30 px-2.5 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-slate-600">Format<Input value={selectedElement.deliverySpec?.format ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), format: event.target.value || undefined } })} placeholder="e.g. PDF" className="mt-1" /></label>
              <label className="block text-xs font-medium text-slate-600">Recipient<Input value={selectedElement.deliverySpec?.recipient ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), recipient: event.target.value || undefined } })} placeholder="Person or team" className="mt-1" /></label>
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-600">Destination<Input value={selectedElement.deliverySpec?.destination ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), destination: event.target.value || undefined } })} placeholder="Workspace, folder, URL, or channel" className="mt-1" /></label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Acceptance criteria<textarea value={(selectedElement.deliverySpec?.acceptanceCriteria ?? []).join('\n')} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), acceptanceCriteria: event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean) } })} rows={4} placeholder="One criterion per line" className="mt-1 w-full resize-y rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Expected artifact count <span className="font-normal text-slate-400">(optional)</span><Input type="number" min={0} step={1} value={selectedElement.deliverySpec?.expectedArtifactCount ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), expectedArtifactCount: event.target.value === '' ? undefined : Math.max(0, Math.floor(Number(event.target.value))) } })} className="mt-1" /></label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Acceptance state
              <Select value={selectedElement.deliverableStatus ?? 'planned'} onValueChange={value => updateElement({ deliverableStatus: value as GoalElement['deliverableStatus'] })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="in-progress">In progress</SelectItem><SelectItem value="ready-for-review">Ready for review</SelectItem><SelectItem value="accepted">Accepted</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
              </Select>
            </label>
            <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50/40 p-2.5">
              <p className="text-[11px] font-semibold text-emerald-800">Delivered outputs</p>
              <p className="mt-1 text-[11px] text-emerald-700/70">Runtime handoff records appear here after execution. Supporting artifacts are kept on separate nodes.</p>
              {(runtimeProjection?.handoffs ?? []).filter(handoff => !handoff.deliverableId || handoff.deliverableId === selectedElement.id).length === 0
                ? <p className="mt-2 text-[11px] text-slate-400">No terminal handoff recorded yet.</p>
                : <div className="mt-2 space-y-2">{(runtimeProjection?.handoffs ?? []).filter(handoff => !handoff.deliverableId || handoff.deliverableId === selectedElement.id).map(handoff => <div key={handoff.id} className="rounded-md border border-emerald-100 bg-white px-2.5 py-2"><p className="text-[10px] text-slate-400">{handoff.deliveredAt ? new Date(handoff.deliveredAt).toLocaleString() : 'Recorded handoff'}</p>{(handoff.producedArtifactReferences ?? []).map((reference, index) => <p key={`${handoff.id}-${index}`} className="mt-1 truncate text-xs font-medium text-slate-700">{reference.label ?? reference.locator ?? 'Produced output'}{reference.format ? ` · ${reference.format}` : ''}</p>)}</div>)}</div>}
            </div>
          </section>
        )}
        {selectedElement.type === 'condition' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Branches</p>
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-[11px] font-semibold text-emerald-800">Positive branch</p>
              <label className="mt-2 block text-xs font-medium text-slate-600">Branch name<Input value={conditionPositiveLabel(selectedElement)} onChange={event => updateElement({ conditionPositiveLabel: event.target.value })} className="mt-1" /></label>
              <label className="mt-2 block text-xs font-medium text-slate-600">Outcome<textarea value={selectedElement.conditionPositiveOutcome ?? ''} onChange={event => updateElement({ conditionPositiveOutcome: event.target.value })} rows={2} placeholder="What happens when the condition is positive?" className="mt-1 w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
            </div>
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/60 p-3">
              <p className="text-[11px] font-semibold text-rose-800">Negative branch</p>
              <label className="mt-2 block text-xs font-medium text-slate-600">Branch name<Input value={conditionNegativeLabel(selectedElement)} onChange={event => updateElement({ conditionNegativeLabel: event.target.value })} className="mt-1" /></label>
              <label className="mt-2 block text-xs font-medium text-slate-600">Outcome<textarea value={selectedElement.conditionNegativeOutcome ?? ''} onChange={event => updateElement({ conditionNegativeOutcome: event.target.value })} rows={2} placeholder="What happens when the condition is negative?" className="mt-1 w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
            </div>
            <p className="mt-2 text-[11px] font-normal text-slate-400">Each branch has its own name and outcome. Connect the positive and negative ports to different next steps.</p>
          </section>
        )}
        {selectedElement.type === 'subgoal' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Handoff</p>
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={selectedElement.handoffRequired === true} onChange={event => updateElement({ handoffRequired: event.target.checked })} /> Require handoff before the next step</label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Handoff notes<textarea value={selectedElement.handoffNotes ?? ''} onChange={event => updateElement({ handoffNotes: event.target.value })} rows={3} placeholder="What must be passed to the next step?" className="mt-1 w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          </section>
        )}
        {selectedElement.type === 'goal' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Schedule</p>
                <p className="mt-1 text-[11px] text-slate-400">Runs create independent lifecycle attempts in the captured timezone.</p>
              </div>
              {!activeSchedule && <button type="button" onClick={createSchedule} className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50">Add</button>}
            </div>
            {activeSchedule ? <div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={activeSchedule.enabled} onChange={event => updateSchedule({ enabled: event.target.checked })} /> Enabled</label>
              <label className="block text-xs font-medium text-slate-600">Run type
                <select value={activeSchedule.rule.mode} onChange={event => updateSchedule({ rule: { mode: event.target.value as GoalSchedule['rule']['mode'] } })} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs">
                  <option value="one-time">One-time</option><option value="recurring">Recurring</option>
                </select>
              </label>
              {activeSchedule.rule.mode === 'recurring' && <label className="block text-xs font-medium text-slate-600">Frequency
                <select value={activeSchedule.rule.frequency ?? 'weekly'} onChange={event => updateSchedule({ rule: { frequency: event.target.value as 'weekly' | 'monthly' } })} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs">
                  <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                </select>
              </label>}
              {activeSchedule.rule.mode === 'recurring' && activeSchedule.rule.frequency === 'weekly' && <label className="block text-xs font-medium text-slate-600">Day of week
                <select value={activeSchedule.rule.dayOfWeek ?? 1} onChange={event => updateSchedule({ rule: { dayOfWeek: Number(event.target.value) } })} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
              </label>}
              {activeSchedule.rule.mode === 'recurring' && activeSchedule.rule.frequency === 'monthly' && <label className="block text-xs font-medium text-slate-600">Day of month
                <Input type="number" min={1} max={31} value={activeSchedule.rule.dayOfMonth ?? 1} onChange={event => updateSchedule({ rule: { dayOfMonth: Math.min(31, Math.max(1, Number(event.target.value) || 1)) } })} className="mt-1" />
              </label>}
              {activeSchedule.rule.mode === 'one-time' && <label className="block text-xs font-medium text-slate-600">Date<Input type="date" value={activeSchedule.rule.date ?? ''} onChange={event => updateSchedule({ rule: { date: event.target.value } })} className="mt-1" /></label>}
              <label className="block text-xs font-medium text-slate-600">Time<Input type="time" value={activeSchedule.rule.time} onChange={event => updateSchedule({ rule: { time: event.target.value } })} className="mt-1" /></label>
              <label className="block text-xs font-medium text-slate-600">Temporal mode
                <select value={activeSchedule.temporalMode} onChange={event => updateSchedule({ temporalMode: event.target.value as GoalSchedule['temporalMode'] })} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="anchored">Anchored data window</option><option value="latest">Latest data on retry</option></select>
              </label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500"><span className="font-semibold text-slate-700">Timezone:</span> {activeSchedule.timezone}<br /><span className="font-semibold text-slate-700">Status:</span> {scheduleStatus(activeSchedule)}</div>
              <div className="grid grid-cols-2 gap-2"><label className="block text-xs font-medium text-slate-600">Starts<input type="date" value={activeSchedule.startsAt?.slice(0, 10) ?? ''} onChange={event => updateSchedule({ startsAt: event.target.value || undefined })} className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs" /></label><label className="block text-xs font-medium text-slate-600">Ends<input type="date" value={activeSchedule.endsAt?.slice(0, 10) ?? ''} onChange={event => updateSchedule({ endsAt: event.target.value || undefined })} className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs" /></label></div>
              <button type="button" onClick={deleteSchedule} className="text-xs font-medium text-red-600 hover:text-red-700">Remove schedule</button>
            </div> : <p className="mt-3 rounded-md border border-dashed border-slate-200 px-2.5 py-2 text-[11px] text-slate-400">No schedule configured. Add one to distinguish one-time and recurring execution.</p>}
          </section>
        )}
        {selectedPolicyElement && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Policy</p>
            <p className="mt-1 text-[11px] text-slate-400">Typed controls become part of the execution contract.</p>
            {runtimeProjection?.execution && <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">Runtime: <span className="font-medium text-slate-800">{runtimeProjection.execution.state ?? 'unknown'}</span> · execution revision {runtimeProjection.execution.revision ?? 0} · policy revision {runtimeProjection.policyRevision ?? 0}</p>}
            {runtimeProjection?.lastChange?.errorCode && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-800">Conflict: <span className="font-semibold">{runtimeProjection.lastChange.errorCode}</span>. The rejected change remains inspectable and canonical state was preserved.</p>}
            {runtimeProjection?.execution?.reconciliationRequired && <p className="mt-2 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-2 text-[11px] text-orange-800">Reconciliation required before execution can continue.</p>}
            {runtimeProjection?.execution?.state === 'approval-required' && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">Approval required before this execution can proceed.</p>}
            {runtimeProjection?.execution?.state === 'blocked' && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">Execution is blocked. Review the runtime policy, dependencies, and agent availability.</p>}
            {runtimeProjection?.agentAvailability?.some(item => !item.available) && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-800">Agent unavailable: dispatch remains blocked until the configured capability is available or an approved fallback is selected.</p>}
            {workspacePolicy && <p className="mt-2 rounded-md border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-[11px] text-blue-800">Workspace policy revision {workspacePolicy.policyRevision} is the inherited baseline. Goal and gate values can only narrow it.</p>}
            {selectedPolicyImpact && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">Active execution has a pending policy impact. {selectedPolicyImpact.requiresUserConfirmation ? 'Confirmation is required before the widened policy can apply.' : 'Pause and review the affected execution before continuing.'}</p>}
            {selectedEffectivePolicy && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[11px] font-medium text-slate-600">Effective policy</p>
              <div className="mt-2 space-y-1.5">
                {GOAL_POLICY_DIMENSIONS.map(dimension => {
                  const explicit = selectedPolicyElement.policy?.dimensions?.[dimension.key] ?? legacyDimensionOverride(selectedPolicyElement.policy, dimension.key);
                  const effective = selectedEffectivePolicy.dimensions[dimension.key];
                  const value = effective.constrained ? `${effective.mode} · ${effective.value} ${dimension.unit}` : 'Unbounded';
                  return <div key={dimension.key} className="flex items-center justify-between gap-2 text-[11px]"><span className="text-slate-500">{dimension.label}</span><span className="text-right text-slate-700"><span>{value}</span><span className="ml-1 text-slate-400">· {explicit ? 'Explicit override' : 'Inherited'}</span></span></div>;
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Acceptance: <span className="font-medium text-slate-700">{selectedEffectivePolicy.acceptance.actor}</span><span className="ml-1 text-slate-400">· {selectedPolicyElement.policy?.acceptanceActor ? 'Explicit override' : 'Inherited'}</span></p>
            </div>}
            {selectedPolicyElement.type === 'goal' && <div className="mt-3 space-y-3">
              <p className="text-[11px] font-medium text-slate-500">Goal budget overrides</p>
              {GOAL_POLICY_DIMENSIONS.map(dimension => {
                const explicit = selectedPolicyElement.policy?.dimensions?.[dimension.key];
                const mode = explicit?.constrained === false ? 'unbounded' : explicit?.mode ?? '__default__';
                const value = explicit?.constrained === true ? explicit.value : '';
                return <div key={dimension.key} className="rounded-lg border border-slate-200 p-2.5">
                  <label className="block text-xs font-medium text-slate-600">{dimension.label}
                    <Select value={mode} onValueChange={nextMode => {
                      if (nextMode === '__default__') updatePolicyDimension(dimension.key, undefined);
                      else if (nextMode === 'unbounded') updatePolicyDimension(dimension.key, { constrained: false });
                      else updatePolicyDimension(dimension.key, { constrained: true, mode: nextMode as Exclude<GoalBudgetMode, 'unbounded'>, value: explicit?.constrained === true ? explicit.value : GOAL_POLICY_SAFE_VALUES[dimension.key], unit: dimension.unit });
                    }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Use workspace default" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Use workspace default</SelectItem>
                        <SelectItem value="hard-cap">Hard cap</SelectItem>
                        <SelectItem value="goal-pool">Goal pool</SelectItem>
                        <SelectItem value="approval-required">Approval required</SelectItem>
                        <SelectItem value="unbounded">Unbounded</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  {explicit?.constrained === true && <div className="mt-2 flex items-center gap-2">
                    <Input type="number" min="0.01" step={dimension.key === 'financial' ? '0.01' : '1'} value={value} onChange={event => { const next = Number(event.target.value); if (Number.isFinite(next) && next > 0 && (dimension.key === 'financial' || Number.isInteger(next))) updatePolicyDimension(dimension.key, { ...explicit, value: next, unit: dimension.unit }); }} aria-label={`${dimension.label} override value`} />
                    <span className="text-[11px] text-slate-400">{dimension.unit}</span>
                  </div>}
                  <span className="mt-1 block text-[11px] text-slate-400">Missing or cleared values inherit the workspace policy.</span>
                </div>;
              })}
            </div>}
            <label className="mt-3 block text-xs font-medium text-slate-600">
              {selectedElement.type === 'approval-gate' ? 'Required approver' : 'Acceptance actor'}
              <Select value={selectedPolicyElement.policy?.acceptanceActor ?? '__default__'} onValueChange={value => updatePolicy({ acceptanceActor: value === '__default__' ? undefined : value as GoalAcceptanceActor })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Use goal default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Use goal default</SelectItem>
                  <SelectItem value="human">Human</SelectItem>
                  <SelectItem value="agentic">Agentic</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {selectedElement.type === 'approval-gate' && <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={selectedElement.approvalEvidenceRequired !== false} onChange={event => updateElement({ approvalEvidenceRequired: event.target.checked })} /> Require evidence before approval</label>}
            <label className="mt-3 block text-xs font-medium text-slate-600">
              Retry budget
              <Select value={selectedPolicyElement.policy?.retryBudgetMode ?? '__default__'} onValueChange={value => updatePolicy({ retryBudgetMode: value === '__default__' ? undefined : value as GoalBudgetMode })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Use goal default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Use goal default</SelectItem>
                  <SelectItem value="hard-cap">Hard cap</SelectItem>
                  <SelectItem value="goal-pool">Goal pool</SelectItem>
                  <SelectItem value="approval-required">Approval required</SelectItem>
                  <SelectItem value="unbounded">Unbounded</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {selectedPolicyElement.policy?.retryBudgetMode !== 'unbounded' && <label className="mt-3 block text-xs font-medium text-slate-600">
              Max retries
              <Input
                type="number"
                min={1}
                step={1}
                value={selectedPolicyElement.policy?.maxRetries ?? ''}
                onChange={event => updatePolicy({ maxRetries: event.target.value === '' ? undefined : Math.max(1, Math.floor(Number(event.target.value))) })}
                className="mt-1"
                aria-describedby="max-retries-help"
              />
              <span id="max-retries-help" className="mt-1 block text-[11px] font-normal text-slate-400">Use a positive whole number. Leave unbounded selected to remove this limit.</span>
            </label>}
          </section>
        )}
        {(selectedElement.type === 'goal' || selectedElement.type === 'subgoal' || selectedElement.type === 'artifact') && <section className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{selectedElement.type === 'artifact' ? 'Supporting artifacts' : 'Execution artifacts'}</p>
          <p className="mt-1 text-[11px] text-slate-400">{selectedElement.type === 'artifact' ? 'These files and references support execution; they never satisfy delivery acceptance.' : 'Links stay attached to this node; task and milestone records remain canonical.'}</p>
          {selectedElement.type !== 'artifact' && <Select onValueChange={value => {
            const option = artifactOptions.find(item => item.value === value);
            if (!option || selectedArtifactReferences.some(reference => reference.artifactType === option.artifactType && reference.artifactId === option.artifactId)) return;
            void updateArtifactReferences([...selectedArtifactReferences, { id: createStableId('artifact-link'), artifactType: option.artifactType, artifactId: option.artifactId, linkedBy: 'renderer', linkedAt: new Date().toISOString() }]);
          }}>
            <SelectTrigger className="mt-2"><SelectValue placeholder="Link a task or milestone" /></SelectTrigger>
            <SelectContent>
              {artifactOptions.filter(option => !selectedArtifactReferences.some(reference => reference.artifactType === option.artifactType && reference.artifactId === option.artifactId)).map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              {artifactOptions.length === 0 && <SelectItem value="__none__" disabled>No tasks or milestones available</SelectItem>}
            </SelectContent>
          </Select>}
          {selectedElement.type === 'artifact' && <div className="mt-3 rounded-md border border-sky-100 bg-sky-50/40 p-2.5">
            <p className="text-[11px] font-semibold text-sky-800">Select a workspace source</p>
            <p className="mt-1 text-[11px] text-sky-700/70">Links the existing attachment without copying its contents into the Goal.</p>
            <label className="mt-3 block text-[11px] font-medium text-slate-600">Artifact type
              <Select value={supportingArtifactType} onValueChange={value => { setSupportingArtifactType(value as SupportingArtifactType); setSupportingSourceSearch(''); }}>
                <SelectTrigger className={`mt-1 ${ARTIFACT_SELECT_CLASS}`}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl"><SelectItem value="document">Document</SelectItem><SelectItem value="file">File</SelectItem><SelectItem value="url">URL</SelectItem><SelectItem value="user-defined">User-defined</SelectItem></SelectContent>
              </Select>
            </label>
            {(supportingArtifactType === 'document' || supportingArtifactType === 'file') && <>
              <label className="mt-3 block text-[11px] font-medium text-slate-600">Search workspace sources
                <Input value={supportingSourceSearch} onChange={event => setSupportingSourceSearch(event.target.value)} placeholder="Search by attachment or task name" className="mt-1 rounded-xl bg-white" />
              </label>
              <label className="mt-3 block text-[11px] font-medium text-slate-600">Workspace source
                <Select onValueChange={addSupportingSourceReference}>
                  <SelectTrigger className={`mt-1 ${ARTIFACT_SELECT_CLASS}`}><SelectValue placeholder={supportingSourceOptions.length ? 'Choose an existing source' : 'No matching sources'} /></SelectTrigger>
                  <SelectContent className="rounded-xl">{supportingSourceOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}<span className="ml-1 text-[10px] text-slate-400">· {option.searchText.replace(option.attachment.name, '').trim()}</span></SelectItem>)}{supportingSourceOptions.length === 0 && <SelectItem value="__none__" disabled>No matching workspace attachments</SelectItem>}</SelectContent>
                </Select>
              </label>
            </>}
            <p className="mt-3 text-[11px] font-semibold text-sky-800">Or declare an external/user-defined source</p>
            <Input value={customArtifactLabel} onChange={event => setCustomArtifactLabel(event.target.value)} placeholder="Artifact label" className="mt-2 bg-white" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select value={customArtifactKind} onValueChange={setCustomArtifactKind}><SelectTrigger className={ARTIFACT_SELECT_CLASS}><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="document">Document</SelectItem><SelectItem value="file">File</SelectItem><SelectItem value="url">URL</SelectItem><SelectItem value="user-defined">User-defined</SelectItem></SelectContent></Select>
              <Input value={customArtifactFormat} onChange={event => setCustomArtifactFormat(event.target.value)} placeholder="Format (optional)" className="bg-white" />
            </div>
            <Input value={customArtifactLocator} onChange={event => setCustomArtifactLocator(event.target.value)} placeholder="Locator or URL (optional)" className="mt-2 bg-white" />
            <button type="button" onClick={addCustomArtifactReference} disabled={!customArtifactLabel.trim()} className="mt-2 rounded-md border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50">Add supporting artifact</button>
          </div>}
          {selectedArtifactReferences.length > 0 ? <div className="mt-2 space-y-2">{selectedArtifactReferences.map(reference => {
            const projection = reference.projection;
            const sourceTask = reference.sourceTaskId ? tasks.find(task => task.id === reference.sourceTaskId) : undefined;
            const sourceAvailable = reference.sourceAttachmentId ? Boolean(sourceTask?.attachments?.some(attachment => attachment.id === reference.sourceAttachmentId)) : undefined;
            const missing = projection?.exists === false || sourceAvailable === false;
            const blocked = projection?.status === 'blocked';
            const approvalRequired = projection?.status === 'approval-required' || selectedElement.status === 'approval-required';
            const status = missing ? 'Stale reference' : blocked ? 'Blocked' : approvalRequired ? 'Approval required' : projection?.status ?? 'Linked';
            const statusClass = missing || blocked ? 'border-rose-200 bg-rose-50 text-rose-700' : approvalRequired ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600';
            return <div key={reference.id} className="rounded-md border border-slate-200 px-2.5 py-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-700">{projection?.title ?? reference.label ?? `${reference.artifactType} · ${reference.artifactId}`}</p><p className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${statusClass}`}>{status.replaceAll('-', ' ')}</p></div><button type="button" onClick={() => void updateArtifactReferences(selectedArtifactReferences.filter(item => item.id !== reference.id))} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Unlink execution artifact">×</button></div>{projection?.exists && <p className="mt-1 text-[10px] text-slate-400">{projection.assigneeId ? `Assignee ${projection.assigneeId}` : 'Unassigned'}{projection.dependencyIds?.length ? ` · ${projection.dependencyIds.length} dependencies` : ''}{projection.evidence?.length ? ` · ${projection.evidence.length} evidence refs` : ''}</p>}{missing && <p className="mt-1 text-[10px] text-rose-600">The source artifact no longer exists and must be relinked.</p>}</div>;
          })}</div> : <p className="mt-2 text-[11px] text-slate-400">No execution artifacts linked yet.</p>}
        </section>}
        {selectedElement.type !== 'connector' && <section className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Connections</p>
          {selectedConnections.length === 0 ? <p className="mt-2 text-[11px] text-slate-400">No connected nodes yet.</p> : <div className="mt-2 space-y-2">{selectedConnections.map(connection => {
            const isSource = connection.sourceId === selectedElement.id;
            const otherId = isSource ? connection.targetId : connection.sourceId;
            const other = activeGoal?.elements.find(element => element.id === otherId);
            const branch = connection.conditionBranch ? ` · ${connection.conditionBranch}` : '';
            return <div key={connection.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2.5 py-2"><span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-700">{isSource ? 'To' : 'From'} · {other?.title ?? 'Missing node'}</span><span className="block truncate text-[11px] capitalize text-slate-400">{connection.title}{branch}</span></span><button type="button" onClick={() => deleteConnection(connection.id)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove connection ${connection.title}`} title="Remove connection"><Link2 className="size-3.5 rotate-45" /></button></div>;
          })}</div>}
        </section>}
        <div className="mt-4 text-xs font-medium text-slate-600">
          {isCompletionElement(selectedElement) ? <>
            <div className="flex items-center gap-1">
              <span>Completion</span>
              <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${compactChipClass(statusChipClass(selectedElement.status))}`}>
                <StatusIcon status={selectedElement.status} className="mr-1 size-3.5" />{statusLabel(selectedElement.status)}
              </span>
            </div>
            <span className="mt-1 block text-[11px] text-slate-400">{statusDescription(selectedElement.status)}</span>
            {statusNextStep(selectedElement.status) && <span className="mt-2 block rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-normal text-slate-600"><span className="font-semibold text-slate-700">Next step: </span>{statusNextStep(selectedElement.status)}</span>}
          </> : (() => { const readiness = readinessForElement(selectedElement, isGoalElementConnected(activeGoal?.elements ?? [], selectedElement.id)); return <>
            <div className="flex items-center gap-1">
              <span>Readiness</span>
              {readiness === 'ready' ? <span className="inline-flex items-center" title="Ready for workflow use"><ReadyIcon /></span> : <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${readinessChipClass(readiness)}`}><CircleDot className="mr-1 size-3.5" />{readinessLabel(readiness)}</span>}
            </div>
            <span className="mt-1 block text-[11px] text-slate-400">{readinessDescription(selectedElement, readiness)}</span>
          </>; })()}
        </div>
        {selectedElement.type === 'connector' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Connection</p>
            <dl className="mt-2 space-y-1 text-[11px] text-slate-500">
              <div className="flex justify-between gap-3"><dt>From</dt><dd className="max-w-[150px] truncate font-medium text-slate-700">{activeGoal?.elements.find(element => element.id === selectedElement.sourceId)?.title ?? 'Missing node'}</dd></div>
              <div className="flex justify-between gap-3"><dt>To</dt><dd className="max-w-[150px] truncate font-medium text-slate-700">{activeGoal?.elements.find(element => element.id === selectedElement.targetId)?.title ?? 'Missing node'}</dd></div>
              <div className="flex justify-between gap-3"><dt>Ports</dt><dd className="font-medium capitalize text-slate-700">{selectedElement.sourceSide ?? 'right'} → {selectedElement.targetSide ?? 'left'}</dd></div>
            </dl>
            {selectedElement.conditionBranch && <div className="mt-2 text-[11px] font-medium capitalize text-slate-500">Branch: {selectedElement.conditionBranch}</div>}
            <button disabled={selectedElement.status === 'permission-denied'} onClick={() => { setConnectorMode(true); setRewireConnectorId(selectedElement.id); setConnectorSourceId(selectedElement.sourceId ?? null); setConnectorSourceSide(selectedElement.sourceSide ?? 'right'); setConnectorSourceBranch(selectedElement.conditionBranch); }} className="mt-4 flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400">
              <Link2 className="size-3.5" /> {selectedElement.status === 'permission-denied' ? 'Rewiring unavailable' : 'Rewire connector'}
            </button>
          </section>
        )}
        <button onClick={deleteElement} className="mt-6 flex items-center gap-2 text-xs font-medium text-red-600 hover:text-red-700">
          <Trash2 className="size-3.5" /> Delete element
        </button>
        </fieldset>
      </aside>
    )}
    {deleteDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-goal-title" aria-describedby="delete-goal-description" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="delete-goal-title" className="text-base font-semibold text-slate-900">Delete this Goal?</h2>
        <p id="delete-goal-description" className="mt-2 text-sm text-slate-500">This removes the Goal graph and its canvas entry. Durable execution history remains preserved.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setDeleteDialogOpen(false)} className="min-h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={performDeleteElement} className="min-h-10 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700">Delete Goal</button>
        </div>
      </div>
    </div>}
    {newGoalDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
      <form role="dialog" aria-modal="true" aria-labelledby="new-goal-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" onSubmit={event => { event.preventDefault(); createGoal(); }}>
        <h2 id="new-goal-title" className="text-base font-semibold text-slate-900">Create a Goal</h2>
        <p className="mt-1 text-sm text-slate-500">Start with the outcome. You can shape the workflow on the canvas afterward.</p>
        <label className="mt-5 block text-xs font-medium text-slate-600">Goal title<Input autoFocus value={newGoalTitle} onChange={event => setNewGoalTitle(event.target.value)} placeholder="e.g. Launch the workspace" className="mt-1" /></label>
        <label className="mt-4 block text-xs font-medium text-slate-600">Outcome and context<textarea value={newGoalBody} onChange={event => setNewGoalBody(event.target.value)} rows={4} placeholder="What should be true when this Goal is complete?" className="mt-1 w-full resize-y rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
        {!goalAuditArchiveDirectory && !goals.length && <div className="mt-4 rounded-md border border-blue-100 bg-blue-50/60 p-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">Choose an audit history location</div>
          <p className="mt-1 leading-4">Goal cleanup attempts are retained indefinitely in an external folder. You can also configure this later in Settings.</p>
          <button type="button" className="mt-2 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50" onClick={async () => { const directory = await window.electron?.goalAudit?.pickDirectory?.(); if (directory) onGoalAuditArchiveDirectoryChange?.(directory); }}>Choose folder</button>
        </div>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setNewGoalDialogOpen(false)} className="min-h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" className="min-h-10 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700">Create Goal</button></div>
      </form>
    </div>}
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      {(spacePressed || panMode) && (
        <div className="pointer-events-none rounded bg-slate-900/80 px-2 py-1 text-xs text-white shadow-sm">
          {spacePressed ? 'Release space to edit' : 'Pan mode · drag to move'}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-2 text-xs text-slate-500 shadow-sm">
        <button
          onClick={() => setPanMode(value => !value)}
          className={`size-8 rounded-full p-2 text-xs ${panMode ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          aria-pressed={panMode}
          aria-label="Pan canvas"
        >
          Pan
        </button>
        <div className="flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
          <button className="rounded-full p-1 hover:bg-slate-100" onClick={() => setZoom(value => Math.max(.6, value - .1))} aria-label="Zoom out"><Minus className="size-3" /></button>
          <span className="min-w-9 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button className="rounded-full p-1 hover:bg-slate-100" onClick={() => setZoom(value => Math.min(1.4, value + .1))} aria-label="Zoom in"><ZoomIn className="size-3" /></button>
        </div>
      </div>
    </div>
  </section>
  );
}
