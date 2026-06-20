import { FolderSearch, Paperclip } from 'lucide-react';
import type { TaskAttachment } from '../types';
import { Button } from '@/app/components/ui/button';

interface TaskAttachmentsSectionProps {
  attachments?: TaskAttachment[];
  canReveal: boolean;
  onRevealAttachment: (filePath: string) => void;
}

export function TaskAttachmentsSection({
  attachments = [],
  canReveal,
  onRevealAttachment,
}: TaskAttachmentsSectionProps) {
  return (
    <div className="min-w-0 space-y-2 rounded-md border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Paperclip className="size-4" />
          Attachments
        </div>
        <div className="text-xs text-gray-500">{attachments.length} total</div>
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map(attachment => {
            const sizeLabel = formatAttachmentSize(attachment.size);
            return (
              <div
                key={attachment.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{attachment.name}</div>
                  <div className="truncate text-xs text-gray-500">
                    {attachment.path}{sizeLabel ? ` - ${sizeLabel}` : ''}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 shrink-0 gap-2 px-2"
                  onClick={() => onRevealAttachment(attachment.path)}
                  disabled={!canReveal}
                >
                  <FolderSearch className="size-4" />
                  Show
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-500">No files attached.</div>
      )}
    </div>
  );
}

function formatAttachmentSize(size?: number): string {
  if (!Number.isFinite(size) || !size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
