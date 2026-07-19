import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, ClipboardCheck, FileText, GitBranch, LockKeyhole, Minus, Plus, ShieldCheck, Sparkles, Target, Trash2, UserRoundCheck, ZoomIn } from 'lucide-react';
import type { GoalAcceptanceActor, GoalBudgetMode, GoalConditionBranch, GoalConnectorSide, GoalElement, GoalElementReadiness, GoalElementType, GoalPolicy, GoalRecord, Person } from '../../types.ts';
import { getCanonicalJSON, safeReadJSON, setCanonicalJSON } from '../../utils/storage.ts';
import { isGoalElementConnected, wouldCreateGoalCycle } from '../../utils/goalCanvas.ts';
import { AgentIcon as Bot } from '../icons/AgentIcon';
import { LinkIcon as Link2 } from '../icons/LinkIcon';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const STORAGE_KEY = 'omvra.goals.v1';
const GOAL_ID = 'goal-lights-off-factory';

function createStableId(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${uuid}`;
}

const INITIAL_GOALS: GoalRecord[] = [{
  id: GOAL_ID,
  title: 'Deliver the roadmap',
  color: '#2563eb',
  overseerAgentId: '1781996246461',
  updatedAt: new Date().toISOString(),
  elements: [
    { id: 'goal-root', type: 'goal', title: 'Deliver the roadmap', body: 'User-driven automation with boundaries', x: 40, y: 220, width: 250, height: 104, status: 'working' },
    { id: 'subgoal-shaping', type: 'subgoal', title: 'Shaping', body: 'Architecture, PRD, and acceptance criteria', x: 360, y: 170, width: 220, height: 90, status: 'complete' },
    { id: 'subgoal-design', type: 'subgoal', title: 'Design', body: 'UX/UI workflow and states', x: 660, y: 170, width: 220, height: 90, status: 'working' },
    { id: 'subgoal-implementation', type: 'subgoal', title: 'Implementation', body: 'Build and integrate the working surface', x: 960, y: 170, width: 220, height: 90, status: 'draft' },
    { id: 'subgoal-qa', type: 'subgoal', title: 'QA', body: 'Verify evidence against acceptance criteria', x: 1260, y: 170, width: 220, height: 90, status: 'draft' },
    { id: 'subgoal-acceptance', type: 'subgoal', title: 'Human acceptance', body: 'Review the evidence and release decision', x: 1560, y: 170, width: 220, height: 90, status: 'draft' },
    { id: 'agent-shaping', type: 'agent', title: 'Product architect', body: 'Architecture persona', assigneeId: '1781996246461', x: 360, y: 310, width: 220, height: 90, status: 'draft' },
    { id: 'agent-design', type: 'agent', title: 'UX designer', body: 'Design persona', assigneeId: '1781994219643', x: 660, y: 310, width: 220, height: 90, status: 'draft' },
    { id: 'agent-implementation', type: 'agent', title: 'Engineering agent', body: 'Implementation persona', assigneeId: '1773751429883', x: 960, y: 310, width: 220, height: 90, status: 'draft' },
    { id: 'agent-qa', type: 'agent', title: 'QA agent', body: 'Testing persona', assigneeId: '1784111829560', x: 1260, y: 310, width: 220, height: 90, status: 'draft' },
    { id: 'instructions-shaping', type: 'instructions', title: 'Shaping instructions', body: 'Scope: shaping subgoal. Produce a versioned brief and acceptance criteria.', x: 360, y: 450, width: 220, height: 90, status: 'draft' },
    { id: 'instructions-design', type: 'instructions', title: 'Design instructions', body: 'Scope: design subgoal. Preserve the approved product contract.', x: 660, y: 450, width: 220, height: 90, status: 'draft' },
    { id: 'instructions-implementation', type: 'instructions', title: 'Implementation instructions', body: 'Scope: implementation subgoal. Return code changes and evidence.', x: 960, y: 450, width: 220, height: 90, status: 'draft' },
    { id: 'condition-qa', type: 'condition', title: 'QA passing requirements', body: 'All acceptance criteria have evidence and no blocking findings remain.', x: 1260, y: 450, width: 220, height: 90, status: 'draft' },
    { id: 'approval-acceptance', type: 'approval-gate', title: 'Human acceptance gate', body: 'Pause before release until the selected human reviewer approves the evidence.', x: 1560, y: 310, width: 220, height: 90, status: 'draft' },
    { id: 'connector-goal', type: 'connector', title: 'Goal → Shaping', x: 0, y: 0, sourceId: 'goal-root', targetId: 'subgoal-shaping', sourceSide: 'right', targetSide: 'left' },
    { id: 'connector-shaping-design', type: 'connector', title: 'Sequence: Shaping → Design', x: 0, y: 0, sourceId: 'subgoal-shaping', targetId: 'subgoal-design', sourceSide: 'right', targetSide: 'left' },
    { id: 'connector-design-implementation', type: 'connector', title: 'Sequence: Design → Implementation', x: 0, y: 0, sourceId: 'subgoal-design', targetId: 'subgoal-implementation', sourceSide: 'right', targetSide: 'left' },
    { id: 'connector-implementation-qa', type: 'connector', title: 'Sequence: Implementation → QA', x: 0, y: 0, sourceId: 'subgoal-implementation', targetId: 'subgoal-qa', sourceSide: 'right', targetSide: 'left' },
    { id: 'connector-qa-acceptance', type: 'connector', title: 'Sequence: QA → Acceptance', x: 0, y: 0, sourceId: 'subgoal-qa', targetId: 'subgoal-acceptance', sourceSide: 'right', targetSide: 'left' },
    { id: 'connector-qa-condition', type: 'connector', title: 'Evaluate QA condition', x: 0, y: 0, sourceId: 'subgoal-qa', targetId: 'condition-qa', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-acceptance-gate', type: 'connector', title: 'Pause for approval', x: 0, y: 0, sourceId: 'subgoal-acceptance', targetId: 'approval-acceptance', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-shaping-agent', type: 'connector', title: 'Worker scope: Shaping', x: 0, y: 0, sourceId: 'subgoal-shaping', targetId: 'agent-shaping', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-design-agent', type: 'connector', title: 'Worker scope: Design', x: 0, y: 0, sourceId: 'subgoal-design', targetId: 'agent-design', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-implementation-agent', type: 'connector', title: 'Worker scope: Implementation', x: 0, y: 0, sourceId: 'subgoal-implementation', targetId: 'agent-implementation', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-qa-agent', type: 'connector', title: 'Worker scope: QA', x: 0, y: 0, sourceId: 'subgoal-qa', targetId: 'agent-qa', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-shaping-instructions', type: 'connector', title: 'Instructions scope: Shaping', x: 0, y: 0, sourceId: 'agent-shaping', targetId: 'instructions-shaping', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-design-instructions', type: 'connector', title: 'Instructions scope: Design', x: 0, y: 0, sourceId: 'agent-design', targetId: 'instructions-design', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-implementation-instructions', type: 'connector', title: 'Instructions scope: Implementation', x: 0, y: 0, sourceId: 'agent-implementation', targetId: 'instructions-implementation', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-qa-condition-scope', type: 'connector', title: 'Condition scope: QA', x: 0, y: 0, sourceId: 'agent-qa', targetId: 'condition-qa', sourceSide: 'bottom', targetSide: 'top' },
  ],
}];

const TOOL_ITEMS: Array<{ type: GoalElementType; label: string; icon: ReactNode }> = [
  { type: 'agent', label: 'Agent', icon: <Bot className="size-3.5" /> },
  { type: 'subgoal', label: 'Subgoal', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>tasks-2</title><g fill="currentColor"><path opacity="0.3" d="M13.75 5.25H7.25C6.145 5.25 5.25 6.145 5.25 7.25V13.75C5.25 14.855 6.145 15.75 7.25 15.75H13.75C14.855 15.75 15.75 14.855 15.75 13.75V7.25C15.75 6.145 14.855 5.25 13.75 5.25Z" fill="currentColor" data-stroke="none" stroke="none" /><path d="M7.99695 11.25L9.60596 12.75L13.003 8.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M13.75 5.25H7.25C6.145 5.25 5.25 6.145 5.25 7.25V13.75C5.25 14.855 6.145 15.75 7.25 15.75H13.75C14.855 15.75 15.75 14.855 15.75 13.75V7.25C15.75 6.145 14.855 5.25 13.75 5.25Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M12.4012 2.74996C12.0022 2.06146 11.2151 1.64841 10.38 1.77291L3.45602 2.80196C2.36402 2.96386 1.61003 3.98093 1.77203 5.07393L2.75002 11.6547" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'connector', label: 'Connector', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>link</title><g fill="currentColor"><path d="M14.6892 9.66862L12.5298 7.5092C11.1486 6.12805 8.90935 6.12805 7.5282 7.5092C6.14704 8.89036 6.14704 11.1296 7.5282 12.5108L9.68761 14.6702C11.0688 16.0514 13.3081 16.0514 14.6892 14.6702C16.0704 13.2891 16.0704 11.0498 14.6892 9.66862Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" /><path d="M8.36909 6.8934C8.06649 7.0539 7.78239 7.2617 7.52799 7.517L7.51799 7.527C6.13699 8.908 6.13699 11.146 7.51799 12.527L9.69299 14.702C11.074 16.083 13.312 16.083 14.693 14.702L14.703 14.692C16.084 13.311 16.084 11.073 14.703 9.692L13.9406 8.9296" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M9.63288 11.1066C9.93548 10.9461 10.2196 10.7383 10.474 10.483L10.484 10.473C11.865 9.09199 11.865 6.85399 10.484 5.47299L8.30899 3.29799C6.92799 1.91699 4.68999 1.91699 3.30899 3.29799L3.29899 3.30799C1.91799 4.68899 1.91799 6.92699 3.29899 8.30799L4.06139 9.07039" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'instructions', label: 'Instructions', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>clipboard-check</title><g fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M6.25 2.75V3.25C6.25 3.80228 6.69772 4.25 7.25 4.25H10.75C11.3023 4.25 11.75 3.80228 11.75 3.25V2.75H12.75C13.855 2.75 14.75 3.645 14.75 4.75V14.25C14.75 15.355 13.855 16.25 12.75 16.25H5.25C4.145 16.25 3.25 15.355 3.25 14.25V4.75C3.25 3.645 4.145 2.75 5.25 2.75H6.25Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" /><path d="M6.25 2.75H5.25C4.145 2.75 3.25 3.645 3.25 4.75V14.25C3.25 15.355 4.145 16.25 5.25 16.25H12.75C13.855 16.25 14.75 15.355 14.75 14.25V4.75C14.75 3.645 13.855 2.75 12.75 2.75H11.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M10.75 1.25H7.25C6.69772 1.25 6.25 1.69772 6.25 2.25V3.25C6.25 3.80228 6.69772 4.25 7.25 4.25H10.75C11.3023 4.25 11.75 3.80228 11.75 3.25V2.25C11.75 1.69772 11.3023 1.25 10.75 1.25Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M6.25 10.25L8 12.25L11.75 7.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'condition', label: 'Condition', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>nodes</title><g fill="currentColor"><path opacity="0.3" d="M9 5.75C10.105 5.75 11 4.855 11 3.75C11 2.645 10.105 1.75 9 1.75C7.895 1.75 7 2.645 7 3.75C7 4.855 7.895 5.75 9 5.75Z" fill="currentColor" data-stroke="none" stroke="none" /><path opacity="0.3" d="M3.80396 14.75C4.90896 14.75 5.80396 13.855 5.80396 12.75C5.80396 11.645 4.90896 10.75 3.80396 10.75C2.69896 10.75 1.80396 11.645 1.80396 12.75C1.80396 13.855 2.69896 14.75 3.80396 14.75Z" fill="currentColor" data-stroke="none" stroke="none" /><path opacity="0.3" d="M14.196 14.75C15.301 14.75 16.196 13.855 16.196 12.75C16.196 11.645 15.301 10.75 14.196 10.75C13.091 10.75 12.196 11.645 12.196 12.75C12.196 13.855 13.091 14.75 14.196 14.75Z" fill="currentColor" data-stroke="none" stroke="none" /><path d="M10.998 3.82599C12.8602 4.45429 14.3295 5.93581 14.9409 7.80551" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M2.87098 10.981C2.48388 9.05459 3.03209 7.041 4.34559 5.5766" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M13.131 14.443C11.655 15.743 9.63592 16.2743 7.70972 15.8675" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M9 5.75C10.105 5.75 11 4.855 11 3.75C11 2.645 10.105 1.75 9 1.75C7.895 1.75 7 2.645 7 3.75C7 4.855 7.895 5.75 9 5.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M3.80396 14.75C4.90896 14.75 5.80396 13.855 5.80396 12.75C5.80396 11.645 4.90896 10.75 3.80396 10.75C2.69896 10.75 1.80396 11.645 1.80396 12.75C1.80396 13.855 2.69896 14.75 3.80396 14.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M14.196 14.75C15.301 14.75 16.196 13.855 16.196 12.75C16.196 11.645 15.301 10.75 14.196 10.75C13.091 10.75 12.196 11.645 12.196 12.75C12.196 13.855 13.091 14.75 14.196 14.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'approval-gate', label: 'Approval gate', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>thumbs-up</title><g fill="currentColor"><path d="M5.25 7.494C5.25 7.014 5.423 6.55 5.736 6.187L10 1.25C10.854 1.677 11.25 2.678 10.92 3.574L9.75 6.75H14.152C15.465 6.75 16.421 7.993 16.085 9.262L14.894 13.762C14.662 14.639 13.868 15.25 12.961 15.25H7.25C6.145 15.25 5.25 14.355 5.25 13.25" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" /><path d="M5.25 7.494C5.25 7.014 5.423 6.55 5.736 6.187L10 1.25C10.854 1.677 11.25 2.678 10.92 3.574L9.75 6.75H14.152C15.465 6.75 16.421 7.993 16.085 9.262L14.894 13.762C14.662 14.639 13.868 15.25 12.961 15.25H7.25C6.145 15.25 5.25 14.355 5.25 13.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M4.25 6.75H2.75C2.19772 6.75 1.75 7.19772 1.75 7.75V14.25C1.75 14.8023 2.19772 15.25 2.75 15.25H4.25C4.80228 15.25 5.25 14.8023 5.25 14.25V7.75C5.25 7.19772 4.80228 6.75 4.25 6.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
  { type: 'goal', label: 'Goal', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>flag-7</title><g fill="currentColor"><path d="M3.75 3.25H11.25C11.802 3.25 12.25 3.698 12.25 4.25V9.25H3.75" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" /><path d="M3.75 3.25H11.25C11.802 3.25 12.25 3.698 12.25 4.25V9.25H3.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M12.25 5.75H14.25C14.802 5.75 15.25 6.198 15.25 6.75V10.75C15.25 11.302 14.802 11.75 14.25 11.75H10.75C10.198 11.75 9.75 11.302 9.75 10.75V9.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M10.043 11.457L12.25 9.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M3.75 1.75V16.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></svg> },
];

function readGoals(): GoalRecord[] {
  const stored = safeReadJSON<GoalRecord[]>(STORAGE_KEY, INITIAL_GOALS);
  if (!Array.isArray(stored) || stored.length === 0) return INITIAL_GOALS;

  // Migrate only the untouched demo graph. User-created graphs are preserved.
  const sample = stored.find(goal => goal.id === GOAL_ID);
  const hasLegacySample = sample
    && sample.elements.some(element => element.id === 'goal-root')
    && !sample.elements.some(element => element.id === 'connector-shaping-design')
    && (sample.elements.some(element => element.title === 'New goal')
      || !sample.elements.some(element => element.id === 'subgoal-acceptance'));
  if (hasLegacySample) {
    return stored.map(goal => goal.id === GOAL_ID ? INITIAL_GOALS[0] : goal);
  }
  return stored;
}

function nodeClass(type: GoalElementType, connected = true): string {
  if (!connected && type === 'instructions') return 'border-slate-200 bg-slate-100 text-slate-500';
  if (type === 'goal') return 'border-slate-900 bg-slate-900 text-white';
  if (type === 'subgoal') return 'border-blue-200 bg-white text-slate-900';
  if (type === 'agent') return 'border-amber-200 bg-amber-50 text-slate-900';
  if (type === 'condition') return 'border-violet-200 bg-violet-50 text-slate-900';
  if (type === 'approval-gate') return 'border-orange-200 bg-orange-50 text-slate-900';
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
  if (element.type === 'agent') return element.assigneeId ? 'ready' : 'not-ready';
  if (element.type === 'instructions') return connected ? 'ready' : 'not-ready';
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
  return readiness === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : readiness === 'unavailable' ? 'border-red-200 bg-red-50 text-red-700'
      : readiness === 'needs-review' ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-100 text-slate-600';
}

function ReadyIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-label="Ready" role="img"><title>Ready</title><path d="M8,0C3.6,0,0,3.6,0,8s3.6,8,8,8,8-3.6,8-8S12.4,0,8,0Zm3.707,6.707l-4,4c-.195,.195-.451,.293-.707,.293s-.512-.098-.707-.293l-2-2c-.391-.391-.391-1.023,0-1.414s1.023-.391,1.414,0l1.293,1.293,3.293-3.293c.391-.391,1.023-.391,1.414,0s.391,1.023,0,1.414Z" fill="#71717A" /></svg>;
}

function readinessDescription(element: GoalElement, readiness: GoalElementReadiness): string {
  if (element.readinessReason) return element.readinessReason;
  if (readiness === 'ready') return 'Configured and available for use in the workflow.';
  if (element.type === 'agent') return 'Assign a canonical agent before this node can be dispatched.';
  if (element.type === 'instructions') return 'Connect this node to a workflow step before it can be used.';
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

export function GoalsView({ people = [] }: { people?: Person[] }) {
  const [goals, setGoals] = useState<GoalRecord[]>(readGoals);
  const [canonicalHydrated, setCanonicalHydrated] = useState(false);
  const canonicalWrite = useRef(Promise.resolve());
  const [selectedGoalId, setSelectedGoalId] = useState(GOAL_ID);
  const [selectedElementId, setSelectedElementId] = useState('goal-root');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
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
  const [canvasElementHeights, setCanvasElementHeights] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeGoal = goals.find(goal => goal.id === selectedGoalId) ?? goals[0];
  const selectedElement = activeGoal?.elements.find(element => element.id === selectedElementId) ?? activeGoal?.elements[0];
  const selectedAgent = selectedElement?.type === 'agent' ? people.find(person => person.id === selectedElement.assigneeId) : undefined;
  const selectedAgentMissing = selectedElement?.type === 'agent' && (!selectedElement.assigneeId || !selectedAgent);
  const selectedPolicyElement = selectedElement?.type === 'subgoal' || selectedElement?.type === 'approval-gate' ? selectedElement : undefined;

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
          const height = Math.round(node.getBoundingClientRect().height);
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

  const getAgentForElement = (element: GoalElement) => element.type === 'agent'
    ? people.find(person => person.id === element.assigneeId)
    : undefined;

  const getElementTitle = (element: GoalElement) => getAgentForElement(element)?.name ?? element.title;
  const getElementBody = (element: GoalElement) => getAgentForElement(element)?.role ?? element.body;

  useEffect(() => {
    let cancelled = false;
    const refreshCanonicalGoals = () => getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null).then(stored => {
      if (cancelled) return;
      if (Array.isArray(stored) && stored.length > 0) setGoals(stored);
    });
    void refreshCanonicalGoals().then(() => {
      setCanonicalHydrated(true);
    });
    window.addEventListener('focus', refreshCanonicalGoals);
    return () => { cancelled = true; window.removeEventListener('focus', refreshCanonicalGoals); };
  }, []);
  useEffect(() => {
    if (!canonicalHydrated) return;
    canonicalWrite.current = canonicalWrite.current.then(async () => {
      const stored = await setCanonicalJSON(STORAGE_KEY, goals);
      if (!stored) {
        const canonical = await getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null);
        if (Array.isArray(canonical) && canonical.length > 0) setGoals(canonical);
      }
    });
  }, [canonicalHydrated, goals]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        setPanMode(false);
        setConnectorMode(false);
      setConnectorSourceId(null);
      setConnectorSourceBranch(undefined);
        setRewireConnectorId(null);
        setAgentMenuOpen(false);
        setNewGoalDialogOpen(false);
        return;
      }
      if (event.code === 'Space' && (event.target === document.body || event.target === canvasRef.current)) { event.preventDefault(); setSpacePressed(true); }
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') setSpacePressed(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => setGoals(current => current.map(goal => goal.id !== selectedGoalId ? goal : ({ ...goal, elements: goal.elements.map(element => element.id !== drag.id ? element : { ...element, x: drag.originX + (event.clientX - drag.startX) / zoom, y: drag.originY + (event.clientY - drag.startY) / zoom }) })));
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [drag, selectedGoalId, zoom]);

  const updateElement = (updates: Partial<GoalElement>) => setGoals(current => current.map(goal => goal.id !== selectedGoalId ? goal : ({ ...goal, updatedAt: new Date().toISOString(), elements: goal.elements.map(element => element.id === selectedElement?.id ? { ...element, ...updates } : element) })));
  const updateGoal = (updates: Partial<GoalRecord>) => setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, ...updates, updatedAt: new Date().toISOString() } : goal));
  const updatePolicy = (updates: Partial<GoalPolicy>) => {
    if (!selectedPolicyElement) return;
    const nextPolicy = { ...selectedPolicyElement.policy, ...updates };
    if (updates.retryBudgetMode === 'unbounded') delete nextPolicy.maxRetries;
    updateElement({ policy: nextPolicy });
  };
  const addElement = (type: GoalElementType) => {
    if (!activeGoal) return;
    const id = createStableId(type === 'connector' ? 'connector' : 'element');
    const title = type === 'subgoal' ? 'New subgoal' : type === 'condition' ? 'New condition' : type === 'approval-gate' ? 'Approval gate' : `New ${type}`;
    const body = type === 'condition' ? 'Define the condition to evaluate' : type === 'approval-gate' ? 'Define who must approve and what evidence is required' : 'Describe the outcome and handoff';
    const element: GoalElement = { id, type, title, body, x: 260 + (activeGoal.elements.length % 3) * 260, y: 560, width: 220, height: 90, status: 'draft' };
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, updatedAt: new Date().toISOString(), elements: [...goal.elements, element] } : goal));
    setSelectedElementId(id);
  };
  const deleteElement = () => {
    if (!selectedElement) return;
    if (selectedElement.type === 'goal') {
      setDeleteDialogOpen(true);
      return;
    }
    performDeleteElement();
  };
  const performDeleteElement = () => {
    if (!selectedElement) return;
    if (selectedElement.type === 'goal') {
      const remainingGoals = goals.filter(goal => goal.id !== selectedGoalId);
      setGoals(remainingGoals);
      const nextGoal = remainingGoals[0];
      setSelectedGoalId(nextGoal?.id ?? '');
      setSelectedElementId(nextGoal?.elements[0]?.id ?? '');
      setDeleteDialogOpen(false);
      return;
    }
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, elements: goal.elements.filter(element => element.id !== selectedElement.id && element.sourceId !== selectedElement.id && element.targetId !== selectedElement.id) } : goal));
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

  const connections = activeGoal?.elements.filter(element => element.type === 'connector') ?? [];
  const selectedConnections = selectedElement?.type !== 'connector'
    ? connections.filter(connection => connection.sourceId === selectedElement?.id || connection.targetId === selectedElement?.id)
    : [];

  const canvasElementHeight = (element: GoalElement) => canvasElementHeights[element.id]
    ?? (element.type === 'condition' ? Math.max(element.height ?? 90, 150) : element.height ?? 90);

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
    const element: GoalElement = { id, type: 'agent', title: person.name, body: person.role, assigneeId: person.id, x: 260 + (activeGoal.elements.length % 3) * 260, y: 560, width: 220, height: 90, status: 'draft' };
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, updatedAt: new Date().toISOString(), elements: [...goal.elements, element] } : goal));
    setSelectedElementId(id);
    setAgentMenuOpen(false);
  };

  const deleteConnection = (connectionId: string) => {
    setGoals(current => current.map(goal => goal.id === selectedGoalId
      ? { ...goal, updatedAt: new Date().toISOString(), elements: goal.elements.filter(element => element.id !== connectionId) }
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
    if (wouldCreateGoalCycle(activeGoal.elements, connectorSourceId, targetId, rewireConnectorId)) {
      setConnectorError('That connection would create a cycle.');
      return;
    }
    setGoals(current => current.map(goal => {
      if (goal.id !== selectedGoalId) return goal;
      const elements = rewireConnectorId
        ? goal.elements.map(element => element.id === rewireConnectorId ? { ...element, sourceId: connectorSourceId, targetId, sourceSide: element.sourceSide ?? connectorSourceSide, targetSide, conditionBranch: connectorSourceBranch } : element)
        : [...goal.elements, { id: createStableId('connector'), type: 'connector' as const, title: 'Node connection', x: 0, y: 0, sourceId: connectorSourceId, targetId, sourceSide: connectorSourceSide, targetSide, conditionBranch: connectorSourceBranch }];
      return { ...goal, updatedAt: new Date().toISOString(), elements };
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

  const renderPorts = (element: GoalElement) => {
    const sides = (['top', 'right', 'bottom', 'left'] as GoalConnectorSide[]).filter(side => element.type !== 'condition' || side !== 'right');
    return <>{sides.map(side => (
      <button key={side} type="button" style={portStyle(side)} className={`absolute size-4 rounded-full border-2 border-white shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceSide === side ? 'bg-amber-400' : 'bg-blue-400'}`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (connectorMode && connectorSourceId) connectNodes(element.id, side); else beginConnection(element.id, side); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${element.title} via ${side} handle`} />
    ))}{element.type === 'condition' && <><button type="button" style={{ right: '-0.5rem', top: '32%', transform: 'translateY(-50%)' }} className={`absolute size-4 rounded-full border-2 border-white bg-emerald-400 shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceBranch === 'positive' ? 'ring-2 ring-amber-400' : ''}`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (connectorMode && connectorSourceId) connectNodes(element.id, 'right'); else beginConnection(element.id, 'right', 'positive'); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${conditionPositiveLabel(element)} branch`} /><button type="button" style={{ right: '-0.5rem', top: '68%', transform: 'translateY(-50%)' }} className={`absolute size-4 rounded-full border-2 border-white bg-rose-400 shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceBranch === 'negative' ? 'ring-2 ring-amber-400' : ''}`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (connectorMode && connectorSourceId) connectNodes(element.id, 'right'); else beginConnection(element.id, 'right', 'negative'); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${conditionNegativeLabel(element)} branch`} /></>}</>;
  };

  return <section className="goals-view relative h-full min-h-0 overflow-hidden bg-slate-50 text-slate-700">
    <aside className={`absolute left-4 top-4 bottom-4 z-20 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-[width] duration-200 ${leftPanelCollapsed ? 'w-12' : 'w-64'}`}>
      <div className={`flex items-center border-b px-3 py-3 ${leftPanelCollapsed ? 'justify-center' : 'justify-between'}`}><div className={leftPanelCollapsed ? 'hidden' : ''}><h1 className="text-sm font-semibold text-slate-900">Goals</h1><p className="mt-0.5 text-xs text-slate-500">Shape work as a loop</p></div><button onClick={() => setLeftPanelCollapsed(value => !value)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={leftPanelCollapsed ? 'Expand goals panel' : 'Collapse goals panel'}>{leftPanelCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}</button></div>
      <div className={`flex-1 space-y-1 overflow-auto p-2 ${leftPanelCollapsed ? 'hidden' : ''}`}>{goals.map(goal => { const goalStatus = goal.elements.find(element => element.type === 'goal')?.status ?? 'draft'; return <button key={goal.id} onClick={() => { setSelectedGoalId(goal.id); setSelectedElementId(goal.elements[0]?.id ?? ''); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${goal.id === selectedGoalId ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><span className="block truncate">{goal.title}</span><span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400"><span>{goal.elements.filter(element => element.type === 'subgoal').length} subgoals · {goal.elements.length} nodes</span><span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium ${statusChipClass(goalStatus)}`}><StatusIcon status={goalStatus} className="size-3" />{statusLabel(goalStatus)}</span></span></button>; })}</div>
      <div className={`flex-1 flex-col items-center gap-2 overflow-auto p-2 ${leftPanelCollapsed ? 'flex' : 'hidden'}`}>{goals.map(goal => <button key={goal.id} onClick={() => { setSelectedGoalId(goal.id); setSelectedElementId(goal.elements[0]?.id ?? ''); }} className={`rounded-lg p-2 ${goal.id === selectedGoalId ? 'bg-slate-100' : 'hover:bg-slate-50'}`} aria-label={goal.title} title={goal.title}><Sparkles className="size-4" style={{ color: goal.color ?? '#2563eb' }} /></button>)}</div>
      <div className={`border-t p-3 ${leftPanelCollapsed ? 'hidden' : ''}`}><button onClick={openNewGoalDialog} className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"><Plus className="size-3.5" /> New goal</button></div>
    </aside>

    <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">{TOOL_ITEMS.map(tool => tool.type === 'agent' ? <div key={tool.type} className="relative"><button disabled={!activeGoal} onClick={() => setAgentMenuOpen(value => !value)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Add agent">{tool.icon}{tool.label}</button>{agentMenuOpen && activeGoal && <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">{people.filter(person => person.kind === 'agentic').map(person => <button key={person.id} onClick={() => addAgent(person)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-slate-100"><Bot className="size-3.5 text-amber-500" /><span><span className="block font-medium text-slate-800">{person.name}</span><span className="block text-[11px] text-slate-400">{person.role}</span></span></button>)}{people.filter(person => person.kind === 'agentic').length === 0 && <p className="px-2.5 py-2 text-xs text-slate-400">No agents configured</p>}</div>}</div> : <button key={tool.type} disabled={!activeGoal} onClick={() => tool.type === 'connector' ? (setConnectorMode(true), setConnectorSourceId(null), setConnectorSourceBranch(undefined)) : addElement(tool.type)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${tool.type === 'connector' && connectorMode ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`} aria-label={`Add ${tool.label}`}>{tool.icon}{tool.type === 'connector' && connectorMode ? 'Choose source' : tool.label}</button>)}</div>

    <div ref={canvasRef} tabIndex={0} role="application" aria-label="Goal canvas. Hold space and drag to pan." className={`h-full w-full outline-none ${spacePressed || panMode ? 'cursor-grab' : 'cursor-default'}`} onPointerDown={event => { if (spacePressed || panMode) { const start = { x: event.clientX, y: event.clientY }; const origin = { ...pan }; const move = (next: PointerEvent) => setPan({ x: origin.x + next.clientX - start.x, y: origin.y + next.clientY - start.y }); const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); } }}>
      <div className="goals-canvas-grid absolute inset-0" aria-hidden="true" />
      {!activeGoal && <div className="absolute inset-0 flex items-center justify-center p-6" role="status" aria-live="polite"><div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm"><div className="mx-auto flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Sparkles className="size-5" /></div><h2 className="mt-3 text-sm font-semibold text-slate-900">Start with a Goal</h2><p className="mt-1 text-xs leading-5 text-slate-500">Create a Goal to shape its subgoals, agents, instructions, and approval gates on the canvas.</p><button type="button" onClick={openNewGoalDialog} className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"><Plus className="size-3.5" /> New goal</button></div></div>}
      <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`, transformOrigin: 'center' }}>
        <svg className="pointer-events-auto absolute left-0 top-0 h-[1200px] w-[2000px] overflow-visible"><defs>{connections.map(connection => <linearGradient key={connection.id} id={`connector-gradient-${connection.id}`} x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stopColor={connection.conditionBranch === 'positive' ? '#34d399' : '#fb7185'} /><stop offset="100%" stopColor="#60a5fa" /></linearGradient>)}</defs>{connections.map(connection => { const path = connectorPath(connection); const branchLabel = connection.conditionBranch ? ` via ${connection.conditionBranch} branch` : ''; return path ? <path key={connection.id} id={`goal-canvas-item-${connection.id}`} d={path} fill="none" stroke={connection.conditionBranch ? `url(#connector-gradient-${connection.id})` : selectedElement?.id === connection.id ? '#2563eb' : '#94a3b8'} strokeWidth={selectedElement?.id === connection.id ? '3' : '2'} strokeLinecap="round" className="cursor-pointer outline-none focus-visible:stroke-blue-600" onClick={event => { event.stopPropagation(); setSelectedElementId(connection.id); setConnectorMode(false); setConnectorSourceId(null); setConnectorSourceBranch(undefined); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedElementId(connection.id); } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveCanvasSelection(connection.id, event.key === 'ArrowRight' || event.key === 'ArrowDown'); } }} role="button" tabIndex={selectedElement?.id === connection.id ? 0 : -1} aria-label={`Connector from ${connection.sourceId} to ${connection.targetId}${branchLabel}`} /> : null; })}</svg>
        {connectorError && <div role="alert" className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 shadow-sm">{connectorError}</div>}
        {activeGoal?.elements.filter(element => element.type !== 'connector').map(element => { const connected = isGoalElementConnected(activeGoal.elements, element.id); const readiness = readinessForElement(element, connected); const readinessDisplay = readiness === 'ready' ? <span className="mt-3 inline-flex items-center" title="Ready for workflow use"><ReadyIcon /></span> : <span className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${readinessChipClass(readiness)}`}><CircleDot className="size-3" />{readinessLabel(readiness)}</span>; return <div key={element.id} id={`goal-canvas-item-${element.id}`} role="group" aria-label={`${element.type}: ${getElementTitle(element)}`} tabIndex={selectedElement?.id === element.id ? 0 : -1} onClick={() => { if (connectorMode) { if (connectorSourceId) connectNodes(element.id); else beginConnection(element.id, 'right'); } else setSelectedElementId(element.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedElementId(element.id); } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveCanvasSelection(element.id, event.key === 'ArrowRight' || event.key === 'ArrowDown'); } }} onPointerDown={event => { if (spacePressed || panMode || connectorMode) return; setSelectedElementId(element.id); setDrag({ id: element.id, startX: event.clientX, startY: event.clientY, originX: element.x, originY: element.y }); }} className={`absolute flex flex-col rounded-lg border p-3 text-left shadow-sm transition-shadow hover:shadow-md ${nodeClass(element.type, connected)} ${selectedElement?.id === element.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`} style={{ left: element.x, top: element.y, width: element.width ?? 220, height: canvasElementHeight(element) }}><span className="flex min-w-0 items-center gap-2 text-xs font-semibold"><span className="rounded bg-black/5 p-1">{element.type === 'agent' ? <Bot className="size-3.5" /> : element.type === 'goal' ? <Sparkles className="size-3.5" /> : <Target className="size-3.5" />}</span><span className="truncate">{getElementTitle(element)}</span></span>{getElementBody(element) && <span className={`mt-2 line-clamp-2 text-[11px] ${element.type === 'goal' ? 'text-slate-300' : 'text-slate-500'}`}>{getElementBody(element)}</span>}{element.type === 'condition' && <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{conditionPositiveLabel(element)}</span><span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-700">{conditionNegativeLabel(element)}</span></div>}{isCompletionElement(element) ? <span className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusChipClass(element.status)}`}><StatusIcon status={element.status} />{statusLabel(element.status)}</span> : readinessDisplay}{renderPorts(element)}</div>; })}
      </div>
    </div>

    {selectedElement && (
      <aside className="absolute bottom-16 right-4 top-16 z-20 w-72 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase text-slate-400">Details</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">{selectedElement.type}</h2>
          </div>
        </div>
        <label className="mt-5 block text-xs font-medium text-slate-600">
          Title
          <Input
            value={selectedAgent?.name ?? selectedElement.title}
            readOnly={selectedElement.type === 'agent'}
            onChange={selectedElement.type === 'agent' ? undefined : event => updateElement({ title: event.target.value })}
            className="mt-1"
          />
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
        <label className="mt-4 block text-xs font-medium text-slate-600">
          Notes
          <textarea
            value={selectedAgent?.role ?? selectedElement.body ?? ''}
            readOnly={selectedElement.type === 'agent'}
            onChange={selectedElement.type === 'agent' ? undefined : event => updateElement({ body: event.target.value })}
            rows={4}
            className="mt-1 w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 read-only:bg-slate-50 read-only:text-slate-500"
          />
        </label>
        {selectedElement.type === 'condition' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Branches</p>
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-[11px] font-semibold text-emerald-800">Positive branch</p>
              <label className="mt-2 block text-xs font-medium text-slate-600">Branch name<Input value={conditionPositiveLabel(selectedElement)} onChange={event => updateElement({ conditionPositiveLabel: event.target.value })} className="mt-1" /></label>
              <label className="mt-2 block text-xs font-medium text-slate-600">Outcome<textarea value={selectedElement.conditionPositiveOutcome ?? ''} onChange={event => updateElement({ conditionPositiveOutcome: event.target.value })} rows={2} placeholder="What happens when the condition is positive?" className="mt-1 w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
            </div>
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/60 p-3">
              <p className="text-[11px] font-semibold text-rose-800">Negative branch</p>
              <label className="mt-2 block text-xs font-medium text-slate-600">Branch name<Input value={conditionNegativeLabel(selectedElement)} onChange={event => updateElement({ conditionNegativeLabel: event.target.value })} className="mt-1" /></label>
              <label className="mt-2 block text-xs font-medium text-slate-600">Outcome<textarea value={selectedElement.conditionNegativeOutcome ?? ''} onChange={event => updateElement({ conditionNegativeOutcome: event.target.value })} rows={2} placeholder="What happens when the condition is negative?" className="mt-1 w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
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
        {selectedPolicyElement && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Policy</p>
            <p className="mt-1 text-[11px] text-slate-400">Typed controls become part of the execution contract.</p>
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
        <label className="mt-4 block text-xs font-medium text-slate-600">
          {isCompletionElement(selectedElement) ? 'Completion' : 'Readiness'}
          {isCompletionElement(selectedElement) ? <>
            <span className={`mt-1 inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusChipClass(selectedElement.status)}`}>
              <StatusIcon status={selectedElement.status} className="mr-1 size-3.5" />{statusLabel(selectedElement.status)}
            </span>
            <span className="mt-1 block text-[11px] text-slate-400">{statusDescription(selectedElement.status)}</span>
            {statusNextStep(selectedElement.status) && <span className="mt-2 block rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-normal text-slate-600"><span className="font-semibold text-slate-700">Next step: </span>{statusNextStep(selectedElement.status)}</span>}
          </> : (() => { const readiness = readinessForElement(selectedElement, isGoalElementConnected(activeGoal?.elements ?? [], selectedElement.id)); return <>{readiness === 'ready' ? <span className="mt-1 inline-flex" title="Ready for workflow use"><ReadyIcon /></span> : <span className={`mt-1 inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${readinessChipClass(readiness)}`}><CircleDot className="mr-1 size-3.5" />{readinessLabel(readiness)}</span>}<span className="mt-1 block text-[11px] text-slate-400">{readinessDescription(selectedElement, readiness)}</span></>; })()}
        </label>
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
        <label className="mt-4 block text-xs font-medium text-slate-600">Outcome and context<textarea value={newGoalBody} onChange={event => setNewGoalBody(event.target.value)} rows={4} placeholder="What should be true when this Goal is complete?" className="mt-1 w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setNewGoalDialogOpen(false)} className="min-h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" className="min-h-10 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700">Create Goal</button></div>
      </form>
    </div>}
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      {(spacePressed || panMode) && (
        <div className="pointer-events-none rounded bg-slate-900/80 px-2 py-1 text-xs text-white shadow-sm">
          {spacePressed ? 'Release space to edit' : 'Pan mode · drag to move'}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
        <button
          onClick={() => setPanMode(value => !value)}
          className={`rounded-md px-2 py-1.5 text-xs ${panMode ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          aria-pressed={panMode}
          aria-label="Pan canvas"
        >
          Pan
        </button>
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1">
          <button className="rounded p-1 hover:bg-slate-100" onClick={() => setZoom(value => Math.max(.6, value - .1))} aria-label="Zoom out"><Minus className="size-3" /></button>
          <span className="min-w-9 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button className="rounded p-1 hover:bg-slate-100" onClick={() => setZoom(value => Math.min(1.4, value + .1))} aria-label="Zoom in"><ZoomIn className="size-3" /></button>
        </div>
      </div>
    </div>
  </section>;
}
