import { ProjectMilestone } from '../types';

export const initialMilestones: ProjectMilestone[] = [
  {
    id: 'milestone-design-freeze',
    title: 'Design freeze',
    projectIds: ['1'],
    startDate: '2026-02-22',
    endDate: '2026-03-04',
    notes: 'Lock the rocket design before launch-readiness work begins.',
    color: '#3b82f6',
    linkedTaskIds: ['1', '4', '6'],
  },
  {
    id: 'milestone-launch-readiness',
    title: 'Launch readiness',
    projectIds: ['2'],
    startDate: '2026-03-02',
    endDate: '2026-03-06',
    notes: 'Validate crew and launch infrastructure readiness.',
    color: '#10b981',
    linkedTaskIds: ['5', '7'],
  },
  {
    id: 'milestone-mission-readiness',
    title: 'Mission readiness review',
    projectIds: ['3'],
    startDate: '2026-02-24',
    endDate: '2026-02-28',
    notes: 'Confirm mission control has the information needed for go/no-go.',
    color: '#8b5cf6',
    linkedTaskIds: ['2', '3'],
  },
];
