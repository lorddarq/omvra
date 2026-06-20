import { Bot, User } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Person, StatusColumn } from '../types';
import { cn } from './ui/utils';

interface PersonStatusCount {
  column: StatusColumn;
  count: number;
}

interface PersonCardProps {
  person: Person;
  totalTasks: number;
  statusCounts: PersonStatusCount[];
  executionLoadPercentage: number;
  pipelineLoadPercentage: number;
  actions?: ReactNode;
}

export function PersonCard(props: PersonCardProps) {
  return (
    <DisplayCard
      {...props}
      typeLabel="Human"
      variant="human"
      icon={<User className="size-4" />}
    />
  );
}

export function AgentCard(props: PersonCardProps) {
  return (
    <DisplayCard
      {...props}
      typeLabel="Agent"
      variant="agent"
      icon={<Bot className="size-4" />}
    />
  );
}

interface DisplayCardProps extends PersonCardProps {
  typeLabel: string;
  variant: 'human' | 'agent';
  icon: ReactNode;
}

function DisplayCard({
  person,
  totalTasks,
  statusCounts,
  executionLoadPercentage,
  pipelineLoadPercentage,
  actions,
  typeLabel,
  variant,
  icon,
}: DisplayCardProps) {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-black/5 bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.08),0_2px_2px_rgba(0,0,0,0.06)]"
      style={variant === 'agent' ? { backgroundImage: getAgentCardBackground(person.name) } : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full text-white',
              variant === 'agent' && 'bg-gradient-to-br from-[#80a8e1] to-[#8d72cf]',
            )}
            style={variant === 'human' ? { backgroundColor: getHumanAvatarColor(person) } : getAgentAvatarStyle(person.name)}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5 text-[#71717a]">{person.name}</div>
            {variant === 'agent' ? (
              <div className="flex flex-wrap items-center gap-1 text-[10px] leading-4 text-[#6a7282]">
                <span>{typeLabel}</span>
                {person.role ? <span className="rounded-full bg-zinc-500/10 px-1.5 py-0.5">{person.role}</span> : null}
              </div>
            ) : (
              <div className="truncate text-[10px] leading-4 text-[#6a7282]">{person.role || typeLabel}</div>
            )}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatusPill label="Total" count={totalTasks} />
        {statusCounts.map(({ column, count }) => (
          <StatusPill key={column.id} label={column.title} count={count} />
        ))}
      </div>

      <div className="h-px bg-[#e6e6e6]" />

      <div className="grid gap-2 sm:grid-cols-2">
        <LoadPill
          label="Execution"
          percentage={executionLoadPercentage}
          neutral={variant === 'agent'}
        />
        <LoadPill
          label="Pipeline"
          percentage={pipelineLoadPercentage}
          neutral={variant === 'agent'}
        />
      </div>
    </div>
  );
}

function StatusPill({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex h-5 items-center gap-1 rounded-full border border-black/5 px-1.5 text-[11px] leading-none text-[#71717a]">
      <span>{label}:</span>
      <span className="font-semibold">{count}</span>
    </div>
  );
}

function LoadPill({ label, percentage, neutral }: { label: string; percentage: number; neutral?: boolean }) {
  const tone = neutral ? getNeutralLoadTone() : getLoadTone(percentage);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="shrink-0 text-xs font-medium leading-5 text-[#71717a]">{label}:</span>
      <span
        className="flex h-5 min-w-0 items-center rounded-full border border-black/5 px-1.5 text-[11px] font-semibold leading-none"
        style={{ backgroundColor: tone.backgroundColor, color: tone.color }}
      >
        {percentage}%
      </span>
    </div>
  );
}

function getLoadTone(percentage: number) {
  if (percentage > 120) return { backgroundColor: '#fbd7d7', color: '#820002' };
  if (percentage >= 80) return { backgroundColor: '#fbeed7', color: '#71717a' };
  return { backgroundColor: '#e7f6ea', color: '#71717a' };
}

function getNeutralLoadTone() {
  return { backgroundColor: '#f6f6f6', color: '#71717a' };
}

function getHumanAvatarColor(person: Person) {
  if (person.color?.startsWith('#') || person.color?.startsWith('rgb')) return person.color;

  const palette = ['#ff06b4', '#80c53f', '#1a60cb', '#f59e0b'];
  return palette[getStableIndex(person.name, palette.length)];
}

function getAgentAvatarStyle(name: string) {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes('claude')) return { background: '#cd9169' };
  if (normalizedName.includes('codex')) return { background: 'linear-gradient(135deg, #80a8e1 0%, #8d72cf 100%)' };
  return undefined;
}

function getAgentCardBackground(name: string) {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes('claude')) {
    return 'linear-gradient(141deg, rgba(224, 211, 202, 0.2) 0.9%, rgba(255, 255, 255, 0.2) 34.3%), #ffffff';
  }

  return 'linear-gradient(141deg, rgba(186, 206, 235, 0.2) 0.9%, rgba(255, 255, 255, 0.2) 34.3%), #ffffff';
}

function getStableIndex(value: string, modulo: number) {
  const hash = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % modulo;
}
