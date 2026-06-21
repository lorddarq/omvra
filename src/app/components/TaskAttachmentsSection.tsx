import { useEffect, useState } from 'react';
import { AlertTriangle, FolderSearch, Paperclip } from 'lucide-react';
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
  const [availabilityByPath, setAvailabilityByPath] = useState<Record<string, boolean | undefined>>({});

  useEffect(() => {
    let isMounted = true;
    const verify = window.electron?.attachments?.verify;

    if (!verify || attachments.length === 0) {
      setAvailabilityByPath({});
      return;
    }

    Promise.all(
      attachments.map(async attachment => {
        const result = await verify(attachment.path).catch(() => null);
        return [attachment.path, Boolean(result?.exists)] as const;
      })
    ).then(results => {
      if (!isMounted) return;
      setAvailabilityByPath(Object.fromEntries(results));
    });

    return () => {
      isMounted = false;
    };
  }, [attachments]);

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-[#71717a]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold leading-5 text-[#71717a]">
          <Paperclip className="size-4" />
          Attachments
        </div>
        <div className="rounded-full border border-black/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[#71717a]">
          {attachments.length}
        </div>
      </div>

      {attachments.length > 0 ? (
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {attachments.map(attachment => {
            const sizeLabel = formatAttachmentSize(attachment.size);
            const isMissing = availabilityByPath[attachment.path] === false;
            return (
              <div
                key={attachment.id}
                className={`flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-3 ${
                  isMissing ? 'border-red-100 bg-red-50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-xs font-medium text-[#6a7282]">{attachment.name}</div>
                    {isMissing && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        <AlertTriangle className="size-3" />
                        Missing
                      </span>
                    )}
                  </div>
                  <div className={`truncate text-[11px] ${isMissing ? 'text-red-600' : 'text-[#8a8a92]'}`}>
                    {attachment.path}
                    {!isMissing && sizeLabel ? ` - ${sizeLabel}` : ''}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 shrink-0 gap-1.5 rounded-full px-2 text-xs"
                  onClick={() => onRevealAttachment(attachment.path)}
                  disabled={!canReveal || isMissing}
                >
                  <FolderSearch className="size-4" />
                  Show
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#71717a]/10 bg-[#71717a]/5 px-4 py-3 text-sm text-[#71717a]">
          No files attached.
        </div>
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
