import { TaskPriority } from '../types';
import urgentIcon from '../images/icons/icon-urgent.svg';
import highIcon from '../images/icons/icon-high.svg';
import normalIcon from '../images/icons/icon-normal.svg';
import lowIcon from '../images/icons/icon-low.svg';

export const TASK_PRIORITY_ICONS: Record<TaskPriority, { label: string; src: string; display: string }> = {
  urgent: { label: 'Urgent priority', src: urgentIcon, display: 'Urgent' },
  moderate: { label: 'High priority', src: highIcon, display: 'Moderate' },
  normal: { label: 'Normal priority', src: normalIcon, display: 'Normal' },
  low: { label: 'Low priority', src: lowIcon, display: 'Low priority' },
};
