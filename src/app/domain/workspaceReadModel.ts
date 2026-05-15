import type { Person, ProjectMilestone, StatusColumn, Task, TimelineSwimlane } from '../types';
import {
  getMilestoneForTask,
  getMilestoneProjectIds,
  summarizeMilestone,
  type RoadmapMilestoneSummary,
} from '../utils/roadmap';

export type TimelineRowMode = 'projects' | 'people';

export interface EnrichedTask {
  task: Task;
  projects: TimelineSwimlane[];
  primaryTimelineProject?: TimelineSwimlane;
  assignee?: Person;
  statusColumn?: StatusColumn;
  milestone?: ProjectMilestone;
  dependencyTasks: EnrichedTask[];
}

export interface EnrichedMilestone {
  milestone: ProjectMilestone;
  projects: TimelineSwimlane[];
  linkedTasks: EnrichedTask[];
  summary: RoadmapMilestoneSummary;
}

export interface WorkspaceReadModel {
  tasks: EnrichedTask[];
  milestones: EnrichedMilestone[];
  tasksById: Map<string, EnrichedTask>;
  milestonesById: Map<string, EnrichedMilestone>;
  projectsById: Map<string, TimelineSwimlane>;
  peopleById: Map<string, Person>;
  statusColumnsById: Map<string, StatusColumn>;
  timelineTasksByProjectId: Map<string, EnrichedTask[]>;
  timelineTasksByAssigneeId: Map<string, EnrichedTask[]>;
  kanbanTasksByStatus: Map<string, EnrichedTask[]>;
}

interface BuildWorkspaceReadModelInput {
  tasks: Task[];
  milestones: ProjectMilestone[];
  projects: TimelineSwimlane[];
  people: Person[];
  statusColumns: StatusColumn[];
}

function groupBy<T>(items: T[], getKey: (item: T) => string | undefined): Map<string, T[]> {
  return items.reduce<Map<string, T[]>>((groups, item) => {
    const key = getKey(item);
    if (!key) return groups;
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
    return groups;
  }, new Map());
}

function getTaskProjectIds(task: Task): string[] {
  if (Array.isArray(task.projectIds) && task.projectIds.length > 0) {
    return task.projectIds;
  }
  return task.swimlaneId ? [task.swimlaneId] : [];
}

export function buildWorkspaceReadModel({
  tasks,
  milestones,
  projects,
  people,
  statusColumns,
}: BuildWorkspaceReadModelInput): WorkspaceReadModel {
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const peopleById = new Map(people.map(person => [person.id, person]));
  const statusColumnsById = new Map(statusColumns.map(column => [column.id, column]));

  const tasksById = new Map<string, EnrichedTask>();
  const enrichedTasks = tasks.map(task => {
    const projectIds = getTaskProjectIds(task);
    const enrichedTask: EnrichedTask = {
      task,
      projects: projectIds
        .map(projectId => projectsById.get(projectId))
        .filter((project): project is TimelineSwimlane => Boolean(project)),
      primaryTimelineProject: task.swimlaneId ? projectsById.get(task.swimlaneId) : undefined,
      assignee: task.assigneeId ? peopleById.get(task.assigneeId) : undefined,
      statusColumn: statusColumnsById.get(task.status),
      milestone: getMilestoneForTask(task, milestones),
      dependencyTasks: [],
    };

    tasksById.set(task.id, enrichedTask);
    return enrichedTask;
  });

  enrichedTasks.forEach(enrichedTask => {
    enrichedTask.dependencyTasks = (enrichedTask.task.dependencyIds || [])
      .map(dependencyId => tasksById.get(dependencyId))
      .filter((task): task is EnrichedTask => Boolean(task));
  });

  const timelineTasksByProjectId = groupBy(enrichedTasks, item => item.task.swimlaneId);
  const timelineTasksByAssigneeId = groupBy(enrichedTasks, item => item.task.assigneeId);
  const kanbanTasksByStatus = groupBy(enrichedTasks, item => item.task.status);

  const milestonesById = new Map<string, EnrichedMilestone>();
  const enrichedMilestones = milestones.map(milestone => {
    const summary = summarizeMilestone(milestone, tasks);
    const linkedTaskIds = new Set(summary.linkedTasks.map(task => task.id));
    const enrichedMilestone: EnrichedMilestone = {
      milestone,
      projects: getMilestoneProjectIds(milestone)
        .map(projectId => projectsById.get(projectId))
        .filter((project): project is TimelineSwimlane => Boolean(project)),
      linkedTasks: enrichedTasks.filter(task => linkedTaskIds.has(task.task.id)),
      summary,
    };

    milestonesById.set(milestone.id, enrichedMilestone);
    return enrichedMilestone;
  });

  return {
    tasks: enrichedTasks,
    milestones: enrichedMilestones,
    tasksById,
    milestonesById,
    projectsById,
    peopleById,
    statusColumnsById,
    timelineTasksByProjectId,
    timelineTasksByAssigneeId,
    kanbanTasksByStatus,
  };
}

export function getTimelineTasksForRow(
  readModel: WorkspaceReadModel,
  rowId: string,
  mode: TimelineRowMode
): EnrichedTask[] {
  const source = mode === 'people'
    ? readModel.timelineTasksByAssigneeId
    : readModel.timelineTasksByProjectId;
  return source.get(rowId) || [];
}

export function getKanbanTasksForStatus(
  readModel: WorkspaceReadModel,
  status: string
): EnrichedTask[] {
  return readModel.kanbanTasksByStatus.get(status) || [];
}
