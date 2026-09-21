import { useRef, type KeyboardEvent } from 'react';
import { ButtonStop } from './icons/button-stop';
import { SendMessage } from './icons/send-message';

interface TaskSessionComposerProps {
  value: string;
  running: boolean;
  busy: boolean;
  disabled?: boolean;
  canSubmit: boolean;
  canStop: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function TaskSessionComposer({
  value,
  running,
  busy,
  canSubmit,
  disabled = false,
  canStop,
  placeholder,
  onChange,
  onSubmit,
  onStop,
}: TaskSessionComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonDisabled = busy || (running ? !canStop : !canSubmit);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || !canSubmit || busy) return;
    event.preventDefault();
    onSubmit();
  };

  return (
    <div
      className="relative flex min-h-[72px] items-end cursor-text rounded-xl border border-black/10 bg-white p-3 shadow-[0_0_0.5px_1px_rgba(113,113,113,0.15)] transition-[border-color,box-shadow] focus-within:border-[#5d9dff] focus-within:ring-2 focus-within:ring-blue-200"
      onClick={() => inputRef.current?.focus()}
    >
      <textarea
        ref={inputRef}
        value={value}
        disabled={disabled}
        rows={2}
        onChange={event => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={running ? 'Add optional guidance to current work' : 'Start an optional follow-up instruction'}
        className="block max-h-32 min-h-10 w-full resize-none bg-transparent pr-8 text-sm leading-5 text-slate-600 outline-none disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-[#aeaeae]"
      />
      <div className="absolute bottom-2 right-2 flex justify-end">
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            if (running) onStop();
            else onSubmit();
          }}
          disabled={buttonDisabled}
          aria-label={running ? 'Stop current work' : 'Send instruction'}
          title={running ? 'Stop current work' : 'Send instruction'}
          className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors enabled:hover:bg-black/5 disabled:opacity-40"
        >
          {running ? <ButtonStop title="" className="size-5" /> : <SendMessage title="" className="size-[18px]" />}
        </button>
      </div>
    </div>
  );
}
