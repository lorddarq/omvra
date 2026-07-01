export {
  getMilestoneDateRangeLabel,
  getMilestoneForTask,
  getMilestoneHealthVisual,
  getMilestoneProjectIds,
  getStatusLabel,
  getStatusVisual,
  getTaskProgress,
  getTasksForMilestone,
  isTaskLateForMilestone,
  MILESTONE_HEALTH_VISUALS,
  resolveStatusColor,
  summarizeMilestone,
  wouldCreateDependencyCycle,
} from '../domain/roadmap';
export type {
  MilestoneHealth,
  MilestoneHealthVisual,
  MilestoneStatusCounts,
  RoadmapMilestoneSummary,
  StatusVisual,
} from '../domain/roadmap';
