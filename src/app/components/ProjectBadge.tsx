import type { TimelineSwimlane } from '../types';
import { getProjectVisual } from '../utils/projectVisual';
import { ProjectColorDot } from './ProjectColorDot';

interface ProjectBadgeProps {
  project?: Pick<TimelineSwimlane, 'id' | 'name' | 'color'> | null;
  label?: string;
  className?: string;
  showDot?: boolean;
}

export function ProjectBadge({
  project,
  label,
  className = 'inline-flex h-5 items-center gap-1.5 rounded-full border border-transparent bg-black/5 px-2 text-[11px] font-semibold text-[#71717a]',
  showDot = true,
}: ProjectBadgeProps) {
  const visual = getProjectVisual(project, { fallbackLabel: label });

  return (
    <span className={className}>
      {showDot ? <ProjectColorDot project={project} className="size-2 rounded-full" /> : null}
      <span className="min-w-0 truncate">{visual.label}</span>
    </span>
  );
}
