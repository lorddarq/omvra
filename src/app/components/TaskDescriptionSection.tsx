import { useState } from 'react';
import { MarkdownContent } from './MarkdownContent';

interface TaskDescriptionSectionProps {
  notes?: string;
}

export function TaskDescriptionSection({ notes }: TaskDescriptionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const normalizedNotes = notes?.trim() || '';
  const isLongDescription = normalizedNotes.length > 900 || normalizedNotes.split('\n').length > 14;

  return (
    <div className="min-w-0 space-y-4">
      {isLongDescription && (
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-[#71717a] hover:bg-[#71717a]/5"
            onClick={() => setIsExpanded(value => !value)}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      )}
      <div
        className={`relative min-w-0 max-w-full overflow-hidden rounded-xl border border-[#71717a]/10 bg-white p-4 text-xs leading-4 text-[#6a7282] ${
          isLongDescription && !isExpanded ? 'max-h-[300px]' : ''
        }`}
      >
        {normalizedNotes ? (
          <MarkdownContent content={normalizedNotes} />
        ) : (
          <div className="text-sm text-[#71717a]">No description provided.</div>
        )}
      </div>
      {isLongDescription && !isExpanded && (
        <div className="-mt-8 h-8 rounded-b-xl bg-gradient-to-b from-white/0 to-white" aria-hidden="true" />
      )}
    </div>
  );
}
