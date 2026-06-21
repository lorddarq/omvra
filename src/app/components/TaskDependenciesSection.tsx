import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { Task } from '../types';

interface TaskDependenciesSectionProps {
  milestoneSelected: boolean;
  milestoneControl: ReactNode;
  dependencyCandidates: Task[];
  dependencyIds: string[];
  taskTitle: string;
  wouldCreateDependencyCycle: (dependencyId: string) => boolean;
  onToggleDependency: (dependencyId: string) => void;
}

export function TaskDependenciesSection({
  milestoneSelected,
  milestoneControl,
  dependencyCandidates,
  dependencyIds,
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_335px]">
        <div className="space-y-1">
          <div className="text-xs font-medium leading-5 text-[#71717a]">Search task:</div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" />
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Task name"
              disabled={!milestoneSelected || dependencyCandidates.length === 0}
              className="h-8 w-full rounded-xl border border-black/10 bg-white/10 pl-8 pr-2 text-sm text-[#1f2937] outline-none placeholder:text-[#b5b5ba] focus:border-[#71717a]/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
        {milestoneControl}
      </div>

      {!milestoneSelected ? (
        <p className="rounded-[18px] bg-white p-4 text-sm text-[#71717a] shadow-[0_0_1px_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
          Select a milestone to choose dependencies.
        </p>
      ) : dependencyCandidates.length === 0 ? (
        <p className="rounded-[18px] bg-white p-4 text-sm text-[#71717a] shadow-[0_0_1px_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
          No other tasks are linked to this milestone yet.
        </p>
      ) : filteredDependencyCandidates.length === 0 ? (
        <p className="rounded-[18px] bg-white p-4 text-sm text-[#71717a] shadow-[0_0_1px_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
          No dependencies match "{searchQuery}".
        </p>
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
                <input
                  type="checkbox"
                  checked={dependencyIds.includes(candidate.id)}
                  disabled={createsCycle}
                  onChange={() => onToggleDependency(candidate.id)}
                  aria-label={`${taskTitle || 'Task'} depends on ${candidate.title}`}
                  className="h-4 w-4 rounded border-[#71717a]/20"
                />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs font-medium leading-5 text-[#4a4a4f]">
                    {candidate.title}
                  </span>
                  <span className="shrink-0 rounded-full border border-black/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[#71717a]">
                    {createsCycle ? 'Cycle' : candidate.status}
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
