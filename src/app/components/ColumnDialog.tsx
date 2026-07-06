import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { StatusColumn } from '../types';
import { Dialog, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { DialogSurface } from './DialogSurface';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

interface ColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, color: string, description?: string) => void;
  onDelete?: () => void;
  column?: StatusColumn | null;
}

const FALLBACK_COLUMN_COLOR = '#9CA3AF';

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!/^#([\da-fA-F]{3}|[\da-fA-F]{6})$/.test(prefixed)) {
    return null;
  }

  if (prefixed.length === 4) {
    const [, r, g, b] = prefixed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return prefixed.toUpperCase();
}

export function ColumnDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  column,
}: ColumnDialogProps) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(FALLBACK_COLUMN_COLOR);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (column) {
      setTitle(column.title || '');
      setColor(column.color || FALLBACK_COLUMN_COLOR);
      setDescription(column.description || '');
    } else {
      setTitle('');
      setColor(FALLBACK_COLUMN_COLOR);
      setDescription('');
    }
  }, [column, isOpen]);

  const normalizedColor = normalizeHexColor(color) ?? FALLBACK_COLUMN_COLOR;

  const handleSave = () => {
    if (!title.trim()) return;
    const normalizedDescription = description.trim();
    onSave(title.trim(), normalizedColor, normalizedDescription || undefined);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogSurface
        showClose={false}
        aria-describedby={undefined}
        overlayClassName="omvra-settings-overlay"
        className="w-[min(429px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[28px] border border-black/5 bg-white p-0 shadow-[0_24px_70px_rgba(15,23,42,0.24)] sm:max-w-none"
      >
        <div className="flex items-start justify-between px-8 pb-0 pt-8">
          <DialogTitle className="text-[15px] font-medium tracking-[-0.02em] text-[#67676f]">
            {column ? 'Edit Column' : 'Create Column'}
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-full text-[#2f2f35] transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
            aria-label="Close dialog"
          >
            <X className="size-5 stroke-[1.75]" />
          </button>
        </div>

        <div className="space-y-5 px-8 pb-8 pt-7">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-[15px] font-medium text-[#67676f]">
              Task name
            </Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_128px]">
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={column ? '' : 'Column name'}
                autoFocus
                className="h-9 rounded-[13px] border-[#d9d9df] bg-white px-3 text-[15px] font-normal text-[#3d3d45] shadow-none placeholder:text-[#b7b7c0] focus-visible:border-[#d0d0d7] focus-visible:ring-2 focus-visible:ring-black/5"
              />
              <div className="relative flex h-9 items-center rounded-[13px] border border-[#d9d9df] bg-white pl-3 pr-3 focus-within:border-[#d0d0d7] focus-within:ring-2 focus-within:ring-black/5">
                <input
                  id="color"
                  type="color"
                  value={normalizedColor}
                  onChange={(event) => setColor(event.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Pick column color"
                />
                <span
                  aria-hidden="true"
                  className="mr-3 size-4 rounded-full border border-black/5"
                  style={{ backgroundColor: normalizedColor }}
                />
                <Input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  placeholder={FALLBACK_COLUMN_COLOR}
                  className="h-full border-0 bg-transparent px-0 py-0 font-mono text-[15px] text-[#3d3d45] shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <p className="max-w-[365px] text-[13px] leading-4 text-[#71717a]">
              Assign a default color for the column to help you identify tasks associated faster.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="column-description" className="text-[15px] font-medium text-[#67676f]">
              Description
            </Label>
            <Textarea
              id="column-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What kind of work belongs here?"
              className="min-h-[96px] rounded-[16px] border-[#d9d9df] bg-white px-3 py-2 text-[14px] text-[#3d3d45] shadow-none placeholder:text-[#b7b7c0] focus-visible:border-[#d0d0d7] focus-visible:ring-2 focus-visible:ring-black/5"
            />
            <p className="max-w-[365px] text-[13px] leading-4 text-[#71717a]">
              Give agents and collaborators a short note about the purpose of this board.
            </p>
          </div>

          <div className="flex items-end justify-between gap-3 pt-8">
            <div>
              {column && onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  className="h-8 rounded-[13px] border-[#f0c8c8] bg-[#fbeaea] px-4 text-[15px] font-normal text-[#ff0000] shadow-none hover:bg-[#f7dddd] hover:text-[#ff0000]"
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-8 rounded-[13px] border-[#d9d9df] bg-white px-4 text-[15px] font-normal text-[#67676f] shadow-none hover:bg-[#f3f3f3] hover:text-[#67676f]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!title.trim()}
                className="h-8 rounded-[13px] border border-[#d9d9df] bg-white px-4 text-[15px] font-normal text-[#67676f] shadow-none hover:bg-[#f3f3f3] hover:text-[#67676f]"
              >
                {column ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      </DialogSurface>
    </Dialog>
  );
}
