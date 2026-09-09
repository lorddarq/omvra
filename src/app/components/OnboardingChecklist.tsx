import { Check, ChevronRight, ListChecks } from 'lucide-react';
import type { Person, Task } from '../types.ts';

interface Props {
  tasks: Task[];
  people: Person[];
  visible: boolean;
  onAddTask: () => void;
  onOpenPeople: () => void;
  onOpenAgents: () => void;
  onOpenWorkspace: () => void;
}

export function OnboardingChecklist({ tasks, people, visible, onAddTask, onOpenPeople, onOpenAgents, onOpenWorkspace }: Props) {
  if (!visible || (tasks.length > 0 && people.length > 0 && tasks.some(task => task.status !== 'open'))) return null;
  const steps = [
    { label: 'Create your first task', done: tasks.length > 0, action: onAddTask },
    { label: 'Add a person or agent', done: people.length > 0, action: people.length > 0 ? onOpenAgents : onOpenPeople },
    { label: 'Move work forward', done: tasks.some(task => task.status !== 'open'), action: onOpenWorkspace },
  ];
  const completed = steps.filter(step => step.done).length;
  const next = steps.find(step => !step.done);
  return <aside className="omvra-onboarding-checklist" aria-labelledby="onboarding-checklist-title">
    <div className="omvra-onboarding-checklist-heading"><span className="omvra-onboarding-checklist-icon"><ListChecks size={17} /></span><div><h2 id="onboarding-checklist-title">Get to first value</h2><p>{completed} of {steps.length} steps complete</p></div></div>
    <div className="omvra-onboarding-checklist-progress" aria-hidden="true"><span style={{ width: `${(completed / steps.length) * 100}%` }} /></div>
    <ol>{steps.map(step => <li key={step.label} className={step.done ? 'is-done' : ''}><span className="omvra-onboarding-check">{step.done ? <Check size={13} /> : null}</span><span>{step.label}</span></li>)}</ol>
    {next && <button type="button" onClick={next.action}>Continue <ChevronRight size={15} /></button>}
  </aside>;
}
