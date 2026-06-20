import { MarkdownContent } from './MarkdownContent';

interface TaskDescriptionSectionProps {
  notes?: string;
}

export function TaskDescriptionSection({ notes }: TaskDescriptionSectionProps) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="text-sm font-semibold text-gray-900">Description</div>
      <div className="min-w-0 max-w-full overflow-hidden rounded-md border bg-white p-4">
        {notes?.trim() ? (
          <MarkdownContent content={notes} />
        ) : (
          <div className="text-sm text-gray-500">No description provided.</div>
        )}
      </div>
    </div>
  );
}
