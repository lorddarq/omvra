import { useState, useEffect } from 'react';
import { TimelineSwimlane } from '../types';
import {
  Dialog,
  DialogFooter,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { DialogSurface, DialogSurfaceHeader, DialogSurfaceSection } from './DialogSurface';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { taskEditFieldClassName, taskEditLabelClassName } from './taskFormStyles';

interface SwimlaneDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (swimlane: Partial<TimelineSwimlane>) => void;
  onDelete?: (swimlaneId: string) => void;
  swimlane?: TimelineSwimlane | null;
}

export function SwimlaneDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  swimlane,
}: SwimlaneDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  useEffect(() => {
    if (swimlane) {
      setName(swimlane.name);
      setColor(swimlane.color || '#3b82f6');
    } else {
      setName('');
      setColor('#3b82f6');
    }
  }, [swimlane, isOpen]);

  const handleSave = () => {
    if (!name.trim()) return;

    const swimlaneData: Partial<TimelineSwimlane> = {
      ...(swimlane && { id: swimlane.id }),
      name: name.trim(),
      color: color || '#3b82f6',
    };

    onSave(swimlaneData);
    onClose();
  };

  const handleDelete = () => {
    if (swimlane && onDelete) {
      onDelete(swimlane.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogSurface className="sm:max-w-[400px]">
        <DialogSurfaceHeader
          title={swimlane ? 'Edit Swimlane' : 'Create Swimlane'}
          description={swimlane ? 'Edit the swimlane details.' : 'Create a new swimlane.'}
        />

        <div className="space-y-4 py-4">
          <div className="space-y-2 px-6">
            <Label htmlFor="name" className={taskEditLabelClassName}>Swimlane Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Frontend Team, Project Alpha, John Doe"
              autoFocus
              className={`${taskEditFieldClassName} h-10`}
            />
            <p className="text-xs leading-5 text-[#7b8190]">
              Name this swimlane by project, team, or person.
            </p>
          </div>

          <DialogSurfaceSection className="mx-6 space-y-2">
            <Label htmlFor="color" className={taskEditLabelClassName}>Swimlane Color</Label>
            <div className="flex items-center gap-3">
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-20 cursor-pointer rounded-2xl border border-black/8 bg-white p-1"
              />
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className={`${taskEditFieldClassName} h-10 flex-1 font-mono text-sm`}
              />
            </div>
            <p className="text-xs leading-5 text-[#7b8190]">
              Color for swimlane label and timeline row background.
            </p>
          </DialogSurfaceSection>
        </div>

        <DialogFooter className="gap-2">
          {swimlane && onDelete && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {swimlane ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogSurface>
    </Dialog>
  );
}
