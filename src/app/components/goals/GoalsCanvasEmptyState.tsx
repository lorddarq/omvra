import { Plus, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';

export function GoalsCanvasEmptyState({ onNewGoal }: { onNewGoal: () => void }) {
  return <div className="absolute inset-0 flex items-center justify-center p-6" role="status" aria-live="polite">
    <div className="max-w-sm rounded-2xl border border-[var(--omvra-color-border-subtle)] bg-[var(--omvra-color-surface-default)] p-6 text-center shadow-[var(--omvra-button-shadow)]">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><Sparkles className="size-5" /></div>
      <h2 className="mt-3 text-sm font-semibold text-slate-900">Start with a Goal</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">Create a Goal to shape its subgoals, agents, instructions, and approval gates on the canvas.</p>
      <Button type="button" onClick={onNewGoal} className="mt-4 text-xs"><Plus className="size-3.5" /> New goal</Button>
    </div>
  </div>;
}
