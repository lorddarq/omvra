import type { ReactNode } from 'react';

interface EmptyStateCardProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyStateCard({
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
}: EmptyStateCardProps) {
  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 rounded-2xl border border-dashed border-black/10 bg-white/75 px-4 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${className}`.trim()}
      >
        {icon ? (
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#f3f4f6] text-[#6a7282]"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="text-sm font-medium leading-5 text-[#111827]">{title}</div>
          {description ? (
            <p className="mt-0.5 text-xs leading-4 text-[#6a7282]">{description}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section
      className={`rounded-[24px] border border-dashed border-black/12 bg-white px-6 py-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_24px_rgba(15,23,42,0.04)] ${className}`.trim()}
    >
      {icon ? (
        <div
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[#f3f4f6] text-[#6a7282]"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#111827]">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#6a7282]">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </section>
  );
}
