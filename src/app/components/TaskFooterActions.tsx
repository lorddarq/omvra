import { DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';

interface TaskFooterActionsProps {
  canMoveToReview?: boolean;
  canEdit?: boolean;
  editAlignsLeft?: boolean;
  onMoveToReview?: () => void;
  onEdit?: () => void;
  onClose: () => void;
}

export function TaskFooterActions({
  canMoveToReview = false,
  canEdit = false,
  editAlignsLeft = false,
  onMoveToReview,
  onEdit,
  onClose,
}: TaskFooterActionsProps) {
  return (
    <DialogFooter className="min-w-0">
      {canMoveToReview && onMoveToReview && (
        <Button
          variant="outline"
          className="mr-auto"
          onClick={onMoveToReview}
        >
          Move to In Review
        </Button>
      )}
      {canEdit && onEdit && (
        <Button
          variant="outline"
          className={editAlignsLeft ? 'mr-auto' : ''}
          onClick={onEdit}
        >
          Edit
        </Button>
      )}
      <Button variant="outline" onClick={onClose}>Close</Button>
    </DialogFooter>
  );
}
