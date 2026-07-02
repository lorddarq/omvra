import { getProjectVisual } from '../utils/projectVisual';
import type { TimelineSwimlane } from '../types';

interface ProjectColorDotProps {
  project?: Pick<TimelineSwimlane, 'id' | 'name' | 'color'> | null;
  color?: string;
  className?: string;
}

export function ProjectColorDot({ project, color, className = 'size-2 rounded-full' }: ProjectColorDotProps) {
  const visual = getProjectVisual(project, { explicitColor: color });
  return <span className={className} style={visual.markerStyle} aria-hidden="true" />;
}
