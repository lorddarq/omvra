import { Bot, User } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Person, StatusColumn } from '../types';
import { getReadableTextClassFor } from '../utils/contrast';

interface PersonStatusCount {
  column: StatusColumn;
  count: number;
}

interface PersonCardProps {
  person: Person;
  totalTasks: number;
  statusCounts: PersonStatusCount[];
}

export function PersonCard({ person, totalTasks, statusCounts }: PersonCardProps) {
  return (
    <DisplayCard
      person={person}
      totalTasks={totalTasks}
      statusCounts={statusCounts}
      typeLabel="Human"
      icon={<User className="w-5 h-5 text-blue-600" />}
    />
  );
}

export function AgentCard({ person, totalTasks, statusCounts }: PersonCardProps) {
  return (
    <DisplayCard
      person={person}
      totalTasks={totalTasks}
      statusCounts={statusCounts}
      typeLabel="Agentic"
      icon={<Bot className="w-5 h-5 text-blue-600" />}
    />
  );
}

interface DisplayCardProps extends PersonCardProps {
  typeLabel: string;
  icon: ReactNode;
}

function DisplayCard({ person, totalTasks, statusCounts, typeLabel, icon }: DisplayCardProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="font-medium">{person.name}</div>
          <div className="text-sm text-gray-500">
            {person.role} • {typeLabel}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="text-xs px-2 py-1 bg-gray-100 rounded">
          Total: {totalTasks}
        </div>
        {statusCounts.map(({ column, count }) => {
          const bgColor = column.color || '#9ca3af';
          const textClass = getReadableTextClassFor(bgColor, bgColor);
          return (
            <div
              key={column.id}
              className={`text-xs px-2 py-1 rounded ${textClass}`}
              style={{ backgroundColor: bgColor }}
            >
              {column.title}: {count}
            </div>
          );
        })}
      </div>
    </div>
  );
}
