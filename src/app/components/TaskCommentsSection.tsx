import type { TaskComment } from '../types';
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
  const hasDraft = newComment.trim().length > 0;

  return (
    <div className="min-w-0 space-y-4">
      <div className="overflow-hidden rounded-[18px] border border-black/[0.06] bg-white shadow-[0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)]">
        <Textarea
          value={newComment}
          onChange={(event) => onNewCommentChange(event.target.value)}
          placeholder="Add a comment..."
          className="min-h-[126px] resize-none rounded-none border-0 bg-white px-4 py-4 text-sm font-medium leading-5 text-[#67676f] shadow-none outline-none placeholder:text-[#b5b5ba] focus-visible:ring-0"
        />
        <div className="flex min-h-12 items-center justify-end gap-2 border-t border-black/[0.06] bg-white px-4">
          <button
            type="button"
            onClick={() => onNewCommentChange('')}
            disabled={!hasDraft}
            className="h-8 rounded-full border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] hover:bg-[#71717a]/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAddComment}
            disabled={!canAddComment}
            className={`h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
              canAddComment
                ? 'bg-[#05051f] text-white hover:bg-[#111133]'
                : 'cursor-not-allowed bg-[#71717a]/15 text-[#71717a]'
            }`}
          >
            Add
          </button>
        </div>
      </div>

      {comments.length > 0 ? (
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div key={comment.id} className="min-w-0 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3 shadow-[0_0_1px_rgba(0,0,0,0.04)]">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 break-words text-sm font-semibold leading-5 text-[#71717a] [overflow-wrap:anywhere]">
                  {comment.author}
                </div>
                <div className="shrink-0 text-xs leading-5 text-[#a5a5ac]">{formatDate(comment.createdAt)}</div>
              </div>
              <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-sm leading-5 text-[#6a7282] [overflow-wrap:anywhere]">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#71717a]/10 bg-[#71717a]/5 px-3 py-2 text-sm text-[#71717a]">
          No comments yet.
        </div>
      )}
    </div>
  );
}
