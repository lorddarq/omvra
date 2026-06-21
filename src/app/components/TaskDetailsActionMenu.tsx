import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Ellipsis, FileText, Pencil, TriangleAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

type CopyState = 'idle' | 'copied' | 'failed';

interface TaskDetailsActionMenuProps {
  copyState: CopyState;
  canEdit: boolean;
  canExportPdf?: boolean;
  onEdit?: () => void;
  onCopy: () => void;
  onExportPdf?: () => void;
}

export function TaskDetailsActionMenu({
  copyState,
  canEdit,
  canExportPdf = false,
  onEdit,
  onCopy,
  onExportPdf,
}: TaskDetailsActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const CopyIcon = copyState === 'copied' ? Check : copyState === 'failed' ? TriangleAlert : Copy;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const runAction = (action?: () => void) => {
    action?.();
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-9 rounded-xl border-black/10 bg-white text-[#71717a] shadow-none hover:bg-[#71717a]/5"
        aria-label="Task actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Task actions"
        onClick={() => setIsOpen(open => !open)}
      >
        <Ellipsis className="size-5" />
      </Button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[34px] z-50 w-[168px] overflow-hidden rounded-xl border border-black/10 bg-white p-1 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.12),0_1px_2px_rgba(0,0,0,0.06)]"
        >
        {canEdit && (
          <button
            type="button"
            role="menuitem"
            className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/10 focus-visible:bg-[#71717a]/10"
            onClick={() => runAction(onEdit)}
          >
            <Pencil className="size-4 shrink-0" />
            Edit
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/10 focus-visible:bg-[#71717a]/10"
          onClick={() => runAction(onCopy)}
          title={copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : undefined}
        >
          <CopyIcon className="size-4 shrink-0" />
          Copy Task Info
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!canExportPdf}
          className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/10 focus-visible:bg-[#71717a]/10 disabled:cursor-not-allowed disabled:text-[#a5a5ac] disabled:hover:bg-transparent disabled:focus-visible:bg-transparent"
          onClick={() => runAction(canExportPdf ? onExportPdf : undefined)}
        >
          <FileText className="size-4 shrink-0" />
          Export PDF
        </button>
        </div>
      )}
    </div>
  );
}
