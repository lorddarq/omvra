export type TaskStatus = 'open' | 'in-progress' | 'under-review' | 'done';
export type TaskSize = 'xs' | 's' | 'm' | 'l';
export type TaskComplexity = 'routine' | 'medium' | 'hard';
export type TaskPriority = 'urgent' | 'moderate' | 'normal' | 'low';
export type PersonKind = 'human' | 'agentic';

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  kind: PersonKind;
  avatar?: string;
  color?: string;
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
  comments?: TaskComment[];
}

export interface Swimlane {
  id: TaskStatus;
  title: string;
  color?: string;
}

export interface TimelineSwimlane {
  id: string;
  name: string;
  subtitle?: string;
  color?: string;
}
