import type { GoalArtifactReference, GoalRecord, ProjectMilestone, SupportingArtifactType, Task } from '../types.ts';
import { createStableId } from './goalElements.ts';

export type GoalArtifactOption = { value: string; label: string; searchText: string; artifactType: 'task' | 'milestone' | 'goal'; artifactId: string };
export type SupportingSourceOption = { value: string; label: string; searchText: string; artifactType: 'document' | 'file'; artifactId: string; taskId: string; attachment: NonNullable<Task['attachments']>[number] };

export function buildArtifactOptions(tasks: Task[], milestones: ProjectMilestone[], goals: GoalRecord[], activeGoalId?: string): GoalArtifactOption[] {
  return [
    ...tasks.map(task => ({ value: `task:${task.id}`, label: `Task · ${task.title}`, searchText: task.title, artifactType: 'task' as const, artifactId: task.id })),
    ...milestones.map(milestone => ({ value: `milestone:${milestone.id}`, label: `Milestone · ${milestone.title}`, searchText: milestone.title, artifactType: 'milestone' as const, artifactId: milestone.id })),
    ...goals.filter(goal => goal.id !== activeGoalId).map(goal => ({ value: `goal:${goal.id}`, label: `Goal · ${goal.title}`, searchText: goal.title, artifactType: 'goal' as const, artifactId: goal.id })),
  ];
}

export function buildSupportingSourceOptions(tasks: Task[], artifactType: SupportingArtifactType, search: string): SupportingSourceOption[] {
  const query = search.trim().toLocaleLowerCase();
  return tasks.flatMap(task => (task.attachments ?? []).map(attachment => {
    const extension = attachment.name.split('.').pop()?.toLowerCase() ?? '';
    const type = new Set(['md', 'markdown', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'odt']).has(extension) ? 'document' as const : 'file' as const;
    return { value: `attachment:${task.id}:${attachment.id}`, label: `${type === 'document' ? 'Document' : 'File'} · ${attachment.name}`, searchText: `${attachment.name} ${task.title}`, artifactType: type, artifactId: attachment.id, taskId: task.id, attachment };
  })).filter(option => option.artifactType === artifactType && option.searchText.toLocaleLowerCase().includes(query));
}

export function createCustomArtifactReference(label: string, kind: string, format: string, locator: string): GoalArtifactReference {
  return {
    id: createStableId('artifact-link'), artifactType: kind === 'url' ? 'url' : kind === 'file' ? 'file' : kind === 'document' ? 'document' : 'user-defined', artifactId: createStableId('artifact'), contribution: 'supporting', label: label.trim(), kind, format: format.trim() || undefined, locator: locator.trim() || undefined, linkedBy: 'renderer', linkedAt: new Date().toISOString(),
  };
}

export function createSupportingSourceReference(option: SupportingSourceOption): GoalArtifactReference {
  return {
    id: createStableId('artifact-link'), artifactType: option.artifactType, artifactId: option.attachment.id, contribution: 'supporting', label: option.attachment.name, kind: option.artifactType, format: option.attachment.name.split('.').pop()?.toUpperCase() || undefined, locator: option.attachment.uri || option.attachment.path, sourceTaskId: option.taskId, sourceAttachmentId: option.attachment.id, linkedBy: 'renderer', linkedAt: new Date().toISOString(),
  };
}
