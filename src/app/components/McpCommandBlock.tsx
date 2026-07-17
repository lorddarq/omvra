import type { ReactNode } from 'react';
import { FilesCopyIcon } from './FilesCopyIcon';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { cn } from './ui/utils';

interface McpCommandBlockProps {
  title: string;
  command: string;
  onCopy: () => void;
  copied: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  description?: string;
  footer?: ReactNode;
  variant?: 'default' | 'subtle';
}

export function McpCommandBlock({
  title,
  command,
  onCopy,
  copied,
  copyLabel = 'Copy command',
  copiedLabel = 'Copied',
  description,
  footer,
  variant = 'default',
}: McpCommandBlockProps) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label className="break-words [overflow-wrap:anywhere]">{title}</Label>
          {description && (
            <p className="mt-1 break-words text-xs text-gray-500 [overflow-wrap:anywhere]">
              {description}
            </p>
          )}
        </div>
        <Button type="button" variant="outline" onClick={onCopy} className="shrink-0">
          <FilesCopyIcon className="mr-2 h-4 w-4" />
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      <pre
        className={cn(
          'max-w-full overflow-x-auto rounded-md border p-3 text-xs text-gray-700',
          variant === 'subtle' ? 'bg-white' : 'bg-gray-50'
        )}
      >
        {command}
      </pre>
      {footer && <div className="space-y-1 text-xs text-gray-500">{footer}</div>}
    </>
  );

  if (variant === 'subtle') {
    return <div className="space-y-2 rounded-lg border bg-gray-50 p-4">{content}</div>;
  }

  return <div className="space-y-2">{content}</div>;
}
