export {
  assertNoDependencyCycle,
  getMilestoneDateRangeLabel,
  getMilestoneForTask,
  getMilestoneHealthVisual,
  getMilestoneProjectIds,
  getTaskProjectIds,
  getTasksForMilestone,
  isTaskLateForMilestone,
  MILESTONE_HEALTH_VISUALS,
  summarizeMilestone,
  wouldCreateDependencyCycle,
} from '../domain/roadmap.ts';
export {
  getStatusLabel,
  getStatusVisual,
  getTaskProgress,
  resolveStatusColor,
} from './statusVisual.ts';
export type {
  MilestoneHealth,
  MilestoneHealthVisual,
  MilestoneStatusCounts,
  RoadmapMilestoneSummary,
} from '../domain/roadmap.ts';
export type { StatusVisual } from './statusVisual.ts';
