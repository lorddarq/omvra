interface TaskCheckboxIndicatorProps {
  checked: boolean;
  disabled?: boolean;
}

export function TaskCheckboxIndicator({ checked, disabled = false }: TaskCheckboxIndicatorProps) {
  return (
    <span className="flex h-[18px] w-4 shrink-0 items-start pt-0.5" aria-hidden="true">
      <span
        className={`relative flex size-4 items-center justify-center rounded-[6px] transition-[background-color,border-color,box-shadow] ${
          checked
            ? 'border border-transparent bg-[#1a60cb] shadow-[0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)]'
            : 'border border-black/15 bg-white'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {checked && (
          <svg
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="size-3"
          >
            <path
              d="M9.75 3.5 5.25 8 2.25 5"
              stroke="#fcfcfc"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </span>
  );
}

interface TaskCheckboxControlProps {
  checked: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onCheckedChange: (checked: boolean) => void;
}

export function TaskCheckboxControl({
  checked,
  disabled = false,
  ariaLabel,
  onCheckedChange,
}: TaskCheckboxControlProps) {
  return (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="pointer-events-none rounded-[6px] peer-focus-visible:ring-2 peer-focus-visible:ring-[#71717a]/20">
        <TaskCheckboxIndicator checked={checked} disabled={disabled} />
      </span>
    </span>
  );
}
