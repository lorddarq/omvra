import type { CSSProperties } from 'react';
import type { TimelineSwimlane } from '../types';

export const DEFAULT_PROJECT_COLOR = '#3b82f6';

type ProjectLike = Pick<TimelineSwimlane, 'id' | 'name' | 'color'>;

export interface ProjectVisual {
  id?: string;
  label: string;
  color: string;
  markerStyle: CSSProperties;
  accentStyle: CSSProperties;
  iconStyle: CSSProperties;
}

export function resolveProjectColor(project?: Pick<TimelineSwimlane, 'color'> | null, explicitColor?: string): string {
  return explicitColor || project?.color || DEFAULT_PROJECT_COLOR;
}

export function getProjectVisual(
  project?: ProjectLike | null,
  options: {
    explicitColor?: string;
    fallbackLabel?: string;
  } = {}
): ProjectVisual {
  const color = resolveProjectColor(project, options.explicitColor);

  return {
    id: project?.id,
    label: project?.name || options.fallbackLabel || 'Unknown project',
    color,
    markerStyle: { backgroundColor: color },
    accentStyle: { '--timeline-row-accent': color } as CSSProperties,
    iconStyle: { color },
  };
}
