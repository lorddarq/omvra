import type { ReactNode } from 'react';

export function GoalsPolicySection({ children }: { children: ReactNode }) {
  return <section className="mt-5 border-t border-slate-100 pt-4">{children}</section>;
}
