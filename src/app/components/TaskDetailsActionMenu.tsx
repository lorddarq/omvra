import { Check, Copy, FileText, TriangleAlert } from 'lucide-react';
import { OverflowActionMenu } from './OverflowActionMenu';
import { PenWritingIcon } from './PenWritingIcon';

type CopyState = 'idle' | 'copied' | 'failed';

interface TaskDetailsActionMenuProps {
  copyState: CopyState;
  canEdit: boolean;
  canExportPdf?: boolean;
  menuLabel?: string;
  copyLabel?: string;
  exportLabel?: string;
  onEdit?: () => void;
  onCopy: () => void;
  onExportPdf?: () => void;
}

export function TaskDetailsActionMenu({
  copyState,
  canEdit,
  canExportPdf = false,
  menuLabel = 'Task actions',
  copyLabel = 'Copy Task Info',
  exportLabel = 'Export PDF',
  onEdit,
  onCopy,
  onExportPdf,
}: TaskDetailsActionMenuProps) {
  const CopyIcon = copyState === 'copied' ? Check : copyState === 'failed' ? TriangleAlert : Copy;

  return (
    <OverflowActionMenu
      menuLabel={menuLabel}
      items={[
        ...(canEdit ? [{ label: 'Edit', icon: PenWritingIcon, onSelect: onEdit }] : []),
        {
          label: copyLabel,
          icon: CopyIcon,
          onSelect: onCopy,
          title: copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : undefined,
        },
        {
          label: exportLabel,
          icon: FileText,
          disabled: !canExportPdf,
          onSelect: canExportPdf ? onExportPdf : undefined,
        },
      ]}
    />
  );
}
