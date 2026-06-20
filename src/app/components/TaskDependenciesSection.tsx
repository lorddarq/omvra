import { GitBranch } from 'lucide-react';
import type { Task } from '../types';
import { Label } from '@/app/components/ui/label';

interface TaskDependenciesSectionProps {
  milestoneSelected: boolean;
  dependencyCandidates: Task[];
  dependencyIds: string[];
  taskTitle: string;
  wouldCreateDependencyCycle: (dependencyId: string) => boolean;
  onToggleDependency: (dependencyId: string) => void;
}

export function TaskDependenciesSection({
  milestoneSelected,
  dependencyCandidates,
  dependencyIds,
  taskTitle,
  wouldCreateDependencyCycle,
  onToggleDependency,
}: TaskDependenciesSectionProps) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Task Dependencies</Label>
      <div className="rounded-xl bg-gray-100 p-3">
        <div className="mb-3 flex items-start gap-2 text-sm text-gray-600">
          <GitBranch className="mt-0.5 size-4 shrink-0 text-gray-700" />
          <p>
            Dependencies are shown on the Roadmap. A task can depend on other tasks linked to the same milestone.
          </p>
        </div>

        {!milestoneSelected ? (
          <p className="rounded-lg bg-white p-3 text-sm text-gray-600">
            Select a Roadmap milestone to choose dependencies.
          </p>
        ) : dependencyCandidates.length === 0 ? (
          <p className="rounded-lg bg-white p-3 text-sm text-gray-600">
            No other tasks are linked to this milestone yet.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {dependencyCandidates.map(candidate => {
              const createsCycle = wouldCreateDependencyCycle(candidate.id);
              return (
                <label
                  key={candidate.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 text-sm ${
                    createsCycle ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={dependencyIds.includes(candidate.id)}
                    disabled={createsCycle}
                    onChange={() => onToggleDependency(candidate.id)}
                    aria-label={`${taskTitle || 'Task'} depends on ${candidate.title}`}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-800">{candidate.title}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {createsCycle ? 'Unavailable because it would create a dependency cycle' : candidate.status}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
