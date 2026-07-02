import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { StatusColumn, Task } from '../types';
import { getStatusLabel } from '../utils/roadmap';
import { EmptyStateCard } from './EmptyStateCard';
import { taskEditIconFieldClassName, taskEditLabelClassName } from './taskFormStyles';
import { TaskCheckboxControl } from './TaskCheckboxControl';

interface TaskDependenciesSectionProps {
  milestoneSelected: boolean;
  milestoneControl: ReactNode;
  dependencyCandidates: Task[];
  dependencyIds: string[];
  statusColumns: StatusColumn[];
  taskTitle: string;
  wouldCreateDependencyCycle: (dependencyId: string) => boolean;
  onToggleDependency: (dependencyId: string) => void;
}

export function TaskDependenciesSection({
  milestoneSelected,
  milestoneControl,
  dependencyCandidates,
  dependencyIds,
  statusColumns,
  taskTitle,
  wouldCreateDependencyCycle,
  onToggleDependency,
}: TaskDependenciesSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredDependencyCandidates = useMemo(
    () => normalizedSearchQuery
      ? dependencyCandidates.filter(candidate => {
          const status = candidate.status || '';
          return (
            candidate.title.toLowerCase().includes(normalizedSearchQuery) ||
            status.toLowerCase().includes(normalizedSearchQuery)
          );
        })
      : dependencyCandidates,
    [dependencyCandidates, normalizedSearchQuery]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(220px,356px)_minmax(180px,200px)]">
        <div className="space-y-1">
          <div className={taskEditLabelClassName}>Search task:</div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Task name"
              disabled={!milestoneSelected || dependencyCandidates.length === 0}
              className={`${taskEditIconFieldClassName} w-full outline-none disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </div>
        </div>
        {milestoneControl}
      </div>

      {!milestoneSelected ? (
        <EmptyStateCard
          compact
          title="Select a milestone first"
          description="Dependencies are milestone-scoped, so pick a roadmap milestone before choosing predecessor tasks."
        />
      ) : dependencyCandidates.length === 0 ? (
        <EmptyStateCard
          compact
          title="No dependency candidates yet"
          description="Link more tasks to this milestone and they will become available as dependency options here."
        />
      ) : filteredDependencyCandidates.length === 0 ? (
        <EmptyStateCard
          compact
          title={`No dependencies match "${searchQuery}"`}
          description="Try a different task title or status to find the milestone dependency you want."
        />
      ) : (
        <div className="max-h-[368px] overflow-y-auto rounded-[18px] bg-white p-3 shadow-[0_0_1px_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
          {filteredDependencyCandidates.map(candidate => {
            const createsCycle = wouldCreateDependencyCycle(candidate.id);
            return (
              <label
                key={candidate.id}
                className={`flex h-9 cursor-pointer items-center gap-2 border-b border-black/5 px-3 py-2 text-sm last:border-b-0 ${
                  createsCycle ? 'cursor-not-allowed opacity-60' : 'hover:bg-[#71717a]/5'
                }`}
              >
                <TaskCheckboxControl
                  checked={dependencyIds.includes(candidate.id)}
                  disabled={createsCycle}
                  onCheckedChange={() => onToggleDependency(candidate.id)}
                  ariaLabel={`${taskTitle || 'Task'} depends on ${candidate.title}`}
                />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs font-medium leading-5 text-[#4a4a4f]">
                    {candidate.title}
                  </span>
                  <span className="shrink-0 rounded-full border border-black/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[#71717a]">
                    {createsCycle ? 'Cycle' : getStatusLabel(statusColumns, candidate.status)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
