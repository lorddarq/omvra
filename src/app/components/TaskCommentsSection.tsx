import { MessageSquarePlus } from 'lucide-react';
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
    <div className="min-w-0 space-y-3 rounded-xl border border-[#71717a]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold leading-5 text-[#71717a]">
          <MessageSquarePlus className="size-4" />
          Comments
        </div>
        <div className="rounded-full border border-black/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[#71717a]">
          {comments.length}
        </div>
      </div>

      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(event) => onNewCommentChange(event.target.value)}
          placeholder="Add a comment..."
          className="min-h-[96px] resize-y rounded-xl border-[#71717a]/10 bg-[#71717a]/5 text-sm text-[#1f2937] placeholder:text-[#a5a5ac]"
        />
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={onAddComment}
            disabled={!canAddComment}
            className="h-8 rounded-full px-3 text-xs"
          >
            Add comment
          </Button>
        </div>
      </div>

      {comments.length > 0 ? (
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div key={comment.id} className="min-w-0 rounded-xl border border-[#71717a]/10 bg-[#71717a]/5 px-4 py-3">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 break-words text-xs font-semibold leading-5 text-[#71717a] [overflow-wrap:anywhere]">
                  {comment.author}
                </div>
                <div className="shrink-0 text-[11px] text-[#8a8a92]">{formatDate(comment.createdAt)}</div>
              </div>
              <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-xs leading-4 text-[#6a7282] [overflow-wrap:anywhere]">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#71717a]/10 bg-[#71717a]/5 px-4 py-3 text-sm text-[#71717a]">
          No comments yet.
        </div>
      )}
    </div>
  );
}
