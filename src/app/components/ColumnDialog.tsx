import { useState, useEffect } from 'react';
import { StatusColumn } from '../types';
import {
  Dialog,
  DialogFooter,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { DialogSurface, DialogSurfaceHeader, DialogSurfaceSection } from './DialogSurface';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { taskEditFieldClassName, taskEditLabelClassName } from './taskFormStyles';

interface ColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, color: string) => void;
  onDelete?: () => void;
  column?: StatusColumn | null;
}

export function ColumnDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  column,
}: ColumnDialogProps) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#9CA3AF');

  useEffect(() => {
    if (column) {
      setTitle(column.title || '');
      setColor(column.color || '#9CA3AF');
    } else {
      setTitle('');
      setColor('#9CA3AF');
    }
  }, [column, isOpen]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(title.trim(), color);
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
      <DialogSurface className="sm:max-w-[425px]">
        <DialogSurfaceHeader
          title={column ? 'Edit Column' : 'Create Column'}
          description={column ? 'Edit the column details below.' : 'Create a new column for your board.'}
        />

        <div className="space-y-4 py-4">
          <div className="space-y-2 px-6">
            <Label htmlFor="title" className={taskEditLabelClassName}>Column Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., In Progress, Review, Done"
              autoFocus
              className={`${taskEditFieldClassName} h-10`}
            />
          </div>

          <DialogSurfaceSection className="mx-6 space-y-2">
            <Label htmlFor="color" className={taskEditLabelClassName}>Column Color</Label>
            <div className="flex items-center gap-3">
              <Input
                id="color"
                type="color"
                value={color.startsWith('#') ? color : '#9CA3AF'}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-20 cursor-pointer rounded-2xl border border-black/8 bg-white p-1"
              />
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#9CA3AF"
                className={`${taskEditFieldClassName} h-10 flex-1 font-mono text-sm`}
              />
            </div>
            <p className="text-xs leading-5 text-[#7b8190]">
              Choose a color to help identify this column.
            </p>
          </DialogSurfaceSection>
        </div>

        <DialogFooter className="gap-2">
          {column && onDelete && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              Delete Column
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            {column ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogSurface>
    </Dialog>
  );
}
