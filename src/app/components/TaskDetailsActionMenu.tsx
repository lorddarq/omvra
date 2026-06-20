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
  const copyLabel = copyState === 'copied' ? 'Copied task info' : copyState === 'failed' ? 'Copy failed' : 'Copy task info';
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
    <div ref={menuRef} className="relative mt-[-2px] shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Task actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Task actions"
        onClick={() => setIsOpen(open => !open)}
      >
        <Ellipsis className="size-4" />
      </Button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-md border bg-white p-1 text-sm shadow-lg"
        >
        {canEdit && (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-gray-900 outline-none hover:bg-gray-100"
            onClick={() => runAction(onEdit)}
          >
            <Pencil className="size-4" />
            Edit
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-gray-900 outline-none hover:bg-gray-100"
          onClick={() => runAction(onCopy)}
        >
          <CopyIcon className="size-4" />
          {copyLabel}
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!canExportPdf}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-gray-400 outline-none hover:bg-gray-100 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          onClick={() => runAction(canExportPdf ? onExportPdf : undefined)}
        >
          <FileText className="size-4" />
          Export PDF
        </button>
        </div>
      )}
    </div>
  );
}
