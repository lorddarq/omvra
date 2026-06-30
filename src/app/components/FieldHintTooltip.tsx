import { useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Label } from './ui/label';

interface FieldHintTooltipProps {
  label: string;
  htmlFor?: string;
  hint: ReactNode;
  labelClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function FieldHintTooltip({
  label,
  htmlFor,
  hint,
  labelClassName,
  triggerClassName,
  contentClassName,
}: FieldHintTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className={labelClassName}>
        {label}
      </Label>
      <button
        type="button"
        aria-label={`More information about ${label}`}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={triggerClassName || 'inline-flex size-4 items-center justify-center rounded-full text-[#9b9ba1] transition-colors hover:text-[#5d5d66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300'}
      >
        <CircleHelp className="size-3.5" />
      </button>
      {open ? (
        <div
          role="tooltip"
          className={contentClassName || 'absolute left-0 top-full z-50 mt-2 max-w-[280px] rounded-xl bg-[#303038] px-3 py-2 text-[11px] leading-4 text-white shadow-lg'}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
