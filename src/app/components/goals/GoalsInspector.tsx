import type { ReactNode } from 'react';
import { Check, Copy, LockKeyhole, Trash2, TriangleAlert } from 'lucide-react';
import type { GoalElement } from '../../types.ts';

interface GoalsInspectorProps {
  selectedElement: GoalElement;
  selectedElementLocked: boolean;
  children: ReactNode;
  onDelete: () => void;
  goalCopyState?: 'idle' | 'copied' | 'failed';
  onCopyGoalDetails?: () => void;
}

export function GoalsInspector({ selectedElement, selectedElementLocked, children, onDelete, goalCopyState = 'idle', onCopyGoalDetails }: GoalsInspectorProps) {
  return <aside className="absolute bottom-16 right-4 top-16 z-20 w-72 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] uppercase text-slate-400">Details</p>
        <h2 className="mt-1 text-sm font-semibold text-slate-900">{selectedElement.type}</h2>
        {selectedElement.type === 'goal' && <button type="button" onClick={onCopyGoalDetails} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50" aria-label="Copy goal details">
          {goalCopyState === 'copied' ? <Check className="size-3.5 text-emerald-600" /> : goalCopyState === 'failed' ? <TriangleAlert className="size-3.5 text-red-600" /> : <Copy className="size-3.5" />}
          {goalCopyState === 'copied' ? 'Copied' : goalCopyState === 'failed' ? 'Copy failed' : 'Copy goal details'}
        </button>}
      </div>
    </div>
    {selectedElementLocked && <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" /><span>{selectedElement.status === 'working' ? 'This node is already in progress. Its structure and execution contract are locked.' : 'This node is committed to execution and cannot be edited here.'}</span></div>}
    <fieldset disabled={selectedElementLocked} className="contents">
      {children}
      <button type="button" disabled={selectedElementLocked} onClick={onDelete} className="mt-6 flex items-center gap-2 text-xs font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40">
        <Trash2 className="size-3.5" /> Delete element
      </button>
    </fieldset>
  </aside>;
}
