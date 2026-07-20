import { AlertTriangle } from 'lucide-react';
import type { GoalAgentConfiguration, GoalAgentMode, GoalElement, GoalRecord, Person } from '../../types.ts';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type GoalsInspectorIdentityProps = {
  element: GoalElement;
  activeGoal?: GoalRecord;
  people: Person[];
  selectedAgent?: Person;
  selectedAgentMissing: boolean;
  selectedAgentConfiguration?: GoalAgentConfiguration;
  selectedAgentMode?: GoalAgentMode;
  onUpdateElement: (updates: Partial<GoalElement>) => void;
  onUpdateGoal: (updates: Partial<GoalRecord>) => void;
  onUpdateAgentName: (name: string) => void;
};

export function GoalsInspectorIdentity({ element, activeGoal, people, selectedAgent, selectedAgentMissing, selectedAgentConfiguration, selectedAgentMode, onUpdateElement, onUpdateGoal, onUpdateAgentName }: GoalsInspectorIdentityProps) {
  return <>
    <label className="mt-5 block text-xs font-medium text-slate-600">
      {element.type === 'agent' ? 'Name' : 'Title'}
      <Input
        value={element.type === 'agent' ? selectedAgent?.name ?? (selectedAgentConfiguration?.autoGenerateName ? '' : selectedAgentConfiguration?.requestedName ?? element.title) : element.title}
        placeholder={element.type === 'agent' && selectedAgentConfiguration?.autoGenerateName ? 'Generated at spawn' : undefined}
        readOnly={element.type === 'agent' && (selectedAgentMode === 'existing' || selectedAgentConfiguration?.autoGenerateName === true)}
        onChange={element.type === 'agent' ? event => onUpdateAgentName(event.target.value) : event => onUpdateElement({ title: event.target.value })}
        className="mt-1"
      />
      {element.type === 'agent' && selectedAgentMode === 'ephemeral' && <span className="mt-1 block text-[11px] font-normal text-slate-400">{selectedAgentConfiguration?.autoGenerateName ? 'The overseer will generate a name when this agent is spawned.' : 'Required task-focused name.'}</span>}
      {selectedAgentMissing && <span role="alert" className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-normal text-amber-800"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Assign a canonical agent before this node can be started or dispatched.</span>}
    </label>
    {element.type === 'goal' && <>
      <label className="mt-4 block text-xs font-medium text-slate-600">
        Color
        <input type="color" value={activeGoal?.color ?? '#2563eb'} onChange={event => onUpdateGoal({ color: event.target.value })} aria-label="Goal color" className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-1" />
      </label>
      <label className="mt-4 block text-xs font-medium text-slate-600">
        Overseer agent
        <Select value={activeGoal?.overseerAgentId ?? '__none__'} onValueChange={value => onUpdateGoal({ overseerAgentId: value === '__none__' ? undefined : value })}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select an agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select an agent</SelectItem>
            {people.filter(person => person.kind === 'agentic').map(person => <SelectItem key={person.id} value={person.id}>{person.name} · {person.role}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="mt-1 block text-[11px] font-normal text-slate-400">This agent derives subgoal status toward the goal.</span>
      </label>
    </>}
    {element.type !== 'agent' && <label className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs font-medium text-slate-600">
      Notes
      <textarea value={element.body ?? ''} onChange={event => onUpdateElement({ body: event.target.value })} rows={4} className="mt-1 w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>}
  </>;
}
