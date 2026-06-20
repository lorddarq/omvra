import type { TaskComment } from '../types';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';

interface TaskCommentsSectionProps {
  comments: TaskComment[];
  newComment: string;
  onNewCommentChange: (value: string) => void;
  onAddComment: () => void;
  formatDate: (dateValue?: string) => string;
  canAddComment: boolean;
}

export function TaskCommentsSection({
  comments,
  newComment,
  onNewCommentChange,
  onAddComment,
  formatDate,
  canAddComment,
}: TaskCommentsSectionProps) {
  return (
    <div className="min-w-0 space-y-3 rounded-md border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">Comments</div>
        <div className="text-xs text-gray-500">{comments.length} total</div>
      </div>

      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(event) => onNewCommentChange(event.target.value)}
          placeholder="Add a comment..."
          className="min-h-[96px] resize-y"
        />
        <div className="flex justify-end">
          <Button variant="outline" onClick={onAddComment} disabled={!canAddComment}>
            Add comment
          </Button>
        </div>
      </div>

      {comments.length > 0 ? (
        <div className="space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="min-w-0 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 break-words text-sm font-medium text-gray-900 [overflow-wrap:anywhere]">
                  {comment.author}
                </div>
                <div className="text-xs text-gray-500">{formatDate(comment.createdAt)}</div>
              </div>
              <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-sm text-gray-700 [overflow-wrap:anywhere]">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">No comments yet.</div>
      )}
    </div>
  );
}
