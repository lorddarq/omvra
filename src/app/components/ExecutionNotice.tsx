import type { ReactNode } from 'react';
import { AlertTriangle, CircleAlert, Info } from 'lucide-react';

type ExecutionNoticeTone = 'info' | 'warning' | 'danger';

export function ExecutionNotice({ tone, title, children, assertive = false, nextStep, actionLabel, onAction }: { tone: ExecutionNoticeTone; title: string; children: ReactNode; assertive?: boolean; nextStep?: string; actionLabel?: string; onAction?: () => void }) {
  const Icon = tone === 'danger' ? CircleAlert : tone === 'warning' ? AlertTriangle : Info;
  const iconClass = tone === 'danger'
    ? 'text-[var(--omvra-color-feedback-danger)]'
    : tone === 'warning'
      ? 'text-[var(--omvra-color-feedback-warning)]'
      : 'text-[var(--omvra-color-feedback-info)]';
  return <div role={assertive || tone === 'danger' ? 'alert' : 'status'} aria-live={assertive || tone === 'danger' ? 'assertive' : 'polite'} className="flex items-start gap-2.5 rounded-lg border border-[var(--omvra-color-border-default)] bg-[var(--omvra-color-surface-subtle)] p-3 text-sm leading-5 text-[var(--omvra-color-text-primary)]">
    <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} aria-hidden="true" />
    <div className="min-w-0 flex-1"><div className="font-semibold">{title}</div><div className="mt-1 text-[var(--omvra-color-text-secondary)]">{children}</div>{nextStep && <div className="mt-2 text-[var(--omvra-color-text-secondary)]"><span className="font-semibold text-[var(--omvra-color-text-primary)]">Next step:</span> {nextStep}</div>}{actionLabel && onAction && <button type="button" onClick={onAction} className="mt-2 min-h-9 rounded-md border border-[var(--omvra-color-border-default)] bg-[var(--omvra-color-surface-default)] px-3 py-1.5 text-xs font-semibold text-[var(--omvra-color-text-primary)] hover:bg-[var(--omvra-color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--omvra-color-focus)] focus-visible:ring-offset-1">{actionLabel}</button>}</div>
  </div>;
}
