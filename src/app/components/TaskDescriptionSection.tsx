import { EmptyStateCard } from './EmptyStateCard';
import { MarkdownContent } from './MarkdownContent';

interface TaskDescriptionSectionProps {
  notes?: string;
  isExpanded?: boolean;
}

export function TaskDescriptionSection({ notes, isExpanded = false }: TaskDescriptionSectionProps) {
  const normalizedNotes = notes?.trim() || '';
  const isLongDescription = normalizedNotes.length > 900 || normalizedNotes.split('\n').length > 14;

  return (
    <div className="min-w-0 space-y-4">
      <div
        className={`relative min-w-0 max-w-full overflow-hidden rounded-xl border border-[#71717a]/10 bg-white p-4 text-xs leading-4 text-[#6a7282] ${
          isLongDescription && !isExpanded ? 'max-h-[300px]' : ''
        }`}
      >
        {normalizedNotes ? (
          <MarkdownContent content={normalizedNotes} />
        ) : (
          <EmptyStateCard
            compact
            title="No description provided"
            description="Add notes, scope, or acceptance details to make this task easier to review and hand off."
          />
        )}
      </div>
      {isLongDescription && !isExpanded && (
        <div className="-mt-[30px] h-8 rounded-b-xl bg-gradient-to-b from-white/0 to-white" aria-hidden="true" />
      )}
    </div>
  );
}
