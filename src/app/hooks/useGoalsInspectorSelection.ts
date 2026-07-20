import { useMemo } from 'react';
import type { GoalAgentMode, GoalPolicyV1, GoalRecord, GoalRuntimeProjection, GoalSchedule, Person, ProjectMilestone, SupportingArtifactType, Task } from '../types.ts';
import { buildArtifactOptions, buildSupportingSourceOptions } from '../utils/goalArtifacts.ts';
import { resolveInspectorPolicy } from '../utils/goalPolicy.ts';

export function useGoalsInspectorSelection({ goals, selectedGoalId, selectedElementId, schedules, people, tasks, milestones, workspacePolicy, runtimeProjection, policyImpacts, supportingArtifactType, supportingSourceSearch }: {
  goals: GoalRecord[];
  selectedGoalId: string;
  selectedElementId: string;
  schedules: GoalSchedule[];
  people: Person[];
  tasks: Task[];
  milestones: ProjectMilestone[];
  workspacePolicy?: GoalPolicyV1;
  runtimeProjection: GoalRuntimeProjection | null;
  policyImpacts: Array<{ goalId?: string; status?: string; requiresUserConfirmation?: boolean }>;
  supportingArtifactType: SupportingArtifactType;
  supportingSourceSearch: string;
}) {
  return useMemo(() => {
    const activeGoal = goals.find(goal => goal.id === selectedGoalId) ?? goals[0];
    const activeSchedule = activeGoal ? schedules.find(schedule => schedule.goalId === activeGoal.id) : undefined;
    const selectedElement = activeGoal?.elements.find(element => element.id === selectedElementId) ?? activeGoal?.elements[0];
    const selectedAgent = selectedElement?.type === 'agent' ? people.find(person => person.id === selectedElement.assigneeId) : undefined;
    const selectedAgentMissing = selectedElement?.type === 'agent' && selectedElement.agentConfiguration?.mode === 'existing' && (!selectedElement.agentConfiguration.assigneeId || !selectedAgent);
    const selectedAgentConfiguration = selectedElement?.type === 'agent' ? selectedElement.agentConfiguration : undefined;
    const selectedAgentMode: GoalAgentMode | undefined = selectedElement?.type === 'agent' ? selectedAgentConfiguration?.mode ?? (selectedElement.assigneeId ? 'existing' : 'ephemeral') : undefined;
    const selectedRetryTarget = selectedElement?.type === 'retry' ? activeGoal?.elements.find(element => element.type === 'connector' && element.sourceId === selectedElement.id)?.targetId : undefined;
    const selectedPolicyElement = selectedElement?.type === 'goal' || selectedElement?.type === 'subgoal' || selectedElement?.type === 'approval-gate' ? selectedElement : undefined;
    const selectedEffectivePolicy = activeGoal && selectedPolicyElement ? (runtimeProjection?.effectivePolicy ?? resolveInspectorPolicy(workspacePolicy, activeGoal, selectedPolicyElement)) : undefined;
    const selectedPolicyImpact = (runtimeProjection?.policyImpacts ?? policyImpacts).find(impact => impact.goalId === activeGoal?.id && impact.status === 'pending');
    const selectedArtifactReferences = selectedElement?.type === 'goal' || selectedElement?.type === 'subgoal' || selectedElement?.type === 'artifact' ? (selectedElement.artifactReferences ?? []) : [];
    const connections = activeGoal?.elements.filter(element => element.type === 'connector') ?? [];
    const selectedConnections = selectedElement?.type !== 'connector' ? connections.filter(connection => connection.sourceId === selectedElement?.id || connection.targetId === selectedElement?.id) : [];
    return {
      activeGoal, activeSchedule, selectedElement, selectedAgent, selectedAgentMissing, selectedAgentConfiguration, selectedAgentMode,
      selectedRetryTarget, selectedPolicyElement, selectedEffectivePolicy, selectedPolicyImpact, selectedArtifactReferences,
      artifactOptions: buildArtifactOptions(tasks, milestones, goals, activeGoal?.id),
      supportingSourceOptions: buildSupportingSourceOptions(tasks, supportingArtifactType, supportingSourceSearch),
      connections, selectedConnections,
    };
  }, [goals, selectedGoalId, selectedElementId, schedules, people, tasks, milestones, workspacePolicy, runtimeProjection, policyImpacts, supportingArtifactType, supportingSourceSearch]);
}
