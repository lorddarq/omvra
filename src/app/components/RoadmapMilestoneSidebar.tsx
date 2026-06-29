import type { ReactNode } from 'react';
import type { ProjectMilestone, TaskStatus, TimelineSwimlane } from '../types';
import type { MilestoneHealth } from '../utils/roadmap';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface RoadmapMilestoneSummary {
  health: MilestoneHealth;
  totalTasks: number;
  completedTasks: number;
  counts: Record<TaskStatus, number>;
}

interface RoadmapMilestoneSidebarRow {
  milestone: ProjectMilestone;
  projects: TimelineSwimlane[];
  summary: RoadmapMilestoneSummary;
  top: number;
  height: number;
}

interface RoadmapMilestoneSidebarProps {
  rows: RoadmapMilestoneSidebarRow[];
  leftWidth: number;
  headerHeight: number;
  chartHeight: number;
  chartScrollTop: number;
  healthLabels: Record<MilestoneHealth, string>;
  healthClasses: Record<MilestoneHealth, string>;
  onAddMilestone: () => void;
  onMilestoneClick: (milestone: ProjectMilestone) => void;
  renderRollupBar: (summary: RoadmapMilestoneSummary) => ReactNode;
}

export function RoadmapMilestoneSidebar({
  rows,
  leftWidth,
  headerHeight,
  chartHeight,
  chartScrollTop,
  healthLabels,
  healthClasses,
  onAddMilestone,
  onMilestoneClick,
  renderRollupBar,
}: RoadmapMilestoneSidebarProps) {
  return (
    <>
      <div
        className="absolute left-0 top-0 z-10 border-r border-gray-200 bg-white"
        style={{ width: leftWidth, height: headerHeight }}
      >
        <div className="flex h-full items-end justify-between px-3 pb-3 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a5a5ac]">
            Milestones
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddMilestone}
            className="h-auto rounded-full px-2 py-1 text-xs font-semibold text-[#1a60cb] hover:bg-[#1a60cb]/6 hover:text-[#1a60cb]"
          >
            Add
          </Button>
        </div>
        <div className="pointer-events-none absolute right-0 top-1/2 flex h-[89px] w-[13px] -translate-y-1/2 items-center justify-center gap-px px-[2px] py-3">
          <span className="h-[13px] w-px bg-[#b8b8b8]" />
          <span className="h-[13px] w-px bg-[#b8b8b8]" />
          <span className="h-[13px] w-px bg-[#b8b8b8]" />
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 top-[82px] z-40 overflow-hidden border-r border-gray-200 bg-[#f9fafb]"
        style={{ width: leftWidth }}
      >
        <div
          className="relative"
          style={{
            height: Math.max(0, chartHeight - headerHeight),
            transform: `translate3d(0, ${-chartScrollTop}px, 0)`,
          }}
        >
          {rows.map(row => {
            const statusCounts = [
              { key: 'open' as const, color: '#c5c5c5', count: row.summary.counts.open || 0 },
              { key: 'done' as const, color: '#3ddfa9', count: row.summary.counts.done || 0 },
              { key: 'under-review' as const, color: '#ffbb28', count: row.summary.counts['under-review'] || 0 },
              { key: 'in-progress' as const, color: '#4c90ff', count: row.summary.counts['in-progress'] || 0 },
            ].filter(item => item.count > 0);

            const remainingCount = Math.max(
              0,
              row.summary.totalTasks - statusCounts.reduce((sum, item) => sum + item.count, 0)
            );

            return (
              <button
                key={row.milestone.id}
                type="button"
                onClick={() => onMilestoneClick(row.milestone)}
                className="absolute left-0 flex w-full flex-col gap-3 border-t border-black/5 bg-white px-3 py-3 text-left hover:bg-[#fcfcfd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
                style={{ top: row.top - headerHeight, height: row.height }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.milestone.color || row.projects[0]?.color || '#6b7280' }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">{row.milestone.title}</span>
                  <span className="shrink-0 text-xs font-semibold text-[#1a60cb]">Open</span>
                </div>

                {renderRollupBar(row.summary)}

                <div className="flex min-w-0 flex-wrap gap-1">
                  {row.projects.length > 0 ? (
                    row.projects.map(project => (
                      <Badge
                        key={`${row.milestone.id}-${project.id}`}
                        variant="outline"
                        className="h-5 rounded-full border-transparent bg-black/5 px-2 text-[11px] font-semibold text-[#71717a]"
                      >
                        {project.name}
                      </Badge>
                    ))
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-5 rounded-full border-transparent bg-black/5 px-2 text-[11px] font-semibold text-[#71717a]"
                    >
                      Unknown project
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-[#71717a]">Tasks</div>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      {statusCounts.map(item => (
                        <div
                          key={`${row.milestone.id}-${item.key}`}
                          className="flex h-5 items-center gap-1 rounded-full border border-black/5 bg-white px-1.5 text-xs font-bold text-[#71717a]"
                        >
                          <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                          <span>{item.count}</span>
                        </div>
                      ))}
                      {remainingCount > 0 ? (
                        <div className="flex h-5 items-center gap-1 rounded-full border border-black/5 bg-white px-1.5 text-xs font-bold text-[#71717a]">
                          <span className="size-2 rounded-full bg-[#ff171b]" aria-hidden="true" />
                          <span>{remainingCount}</span>
                        </div>
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      className={`h-5 rounded-full px-2 text-[10px] font-medium ${healthClasses[row.summary.health]}`}
                    >
                      {healthLabels[row.summary.health]}
                    </Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
