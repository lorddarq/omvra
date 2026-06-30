export type TaskStatus = 'open' | 'in-progress' | 'under-review' | 'done';
export type TaskSize = 'xs' | 's' | 'm' | 'l';
export type TaskComplexity = 'routine' | 'medium' | 'hard';
export type TaskPriority = 'urgent' | 'moderate' | 'normal' | 'low';
export type PersonKind = 'human' | 'agentic';

export interface StatusColumn {
  id: string;
  title: string;
  color?: string;
}

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface TaskTimeEntry {
  id: string;
  minutes: number;
  note?: string;
  loggedAt: string;
  actor?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  path: string;
  uri: string;
  size?: number;
  addedAt: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  kind: PersonKind;
  avatar?: string;
  color?: string;
  agentInstructions?: string;
  agentOperationalInstructions?: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  notes?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
  size?: TaskSize;
  complexity?: TaskComplexity;
  blocked?: boolean;
  priority?: TaskPriority;
  swimlaneOnly?: boolean; // Tasks that only appear in swimlanes
  swimlaneId?: string; // Which timeline swimlane row this task belongs to
  projectIds?: string[]; // Projects this task belongs to
  assigneeId?: string; // Person assigned to this task
  project?: string; // Project this task belongs to
  milestoneId?: string; // Primary roadmap milestone this task contributes to
  dependencyIds?: string[]; // Roadmap-only dependencies used for milestone planning arrows
  timeSpentMinutes?: number; // Approximate total time spent on this task
  timeSpentNote?: string; // Latest human-readable time-spent note/source
  timeEntries?: TaskTimeEntry[]; // Optional append-only approximate time log
  attachments?: TaskAttachment[]; // Local file references attached to this task
  comments?: TaskComment[];
}

export interface ProjectMilestone {
  id: string;
  convexId?: string;
  title: string;
  projectIds: string[];
  projectId?: string; // Legacy single-project milestone field kept for migration.
  startDate?: string;
  endDate: string;
  notes?: string;
  color?: string;
  linkedTaskIds?: string[];
}

export type Swimlane = StatusColumn;

export interface TimelineSwimlane {
  id: string;
  name: string;
  subtitle?: string;
  color?: string;
}

export interface StorageMeter {
  usedBytes: number;
  totalBytes: number;
  usagePercent: number;
  sourceLabel: string;
}
