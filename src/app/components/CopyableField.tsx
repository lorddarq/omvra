import { FilesCopyIcon } from './icons/FilesCopyIcon';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface CopyableFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  copied: boolean;
  description?: string;
  copyLabel?: string;
  copiedLabel?: string;
}

export function CopyableField({
  id,
  label,
  value,
  onChange,
  onCopy,
  copied,
  description,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
}: CopyableFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 min-w-0 flex-1"
        />
        <Button type="button" variant="outline" onClick={onCopy} className="shrink-0">
        <FilesCopyIcon className="mr-2 h-4 w-4" />
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      {description && (
        <p className="break-words text-xs text-gray-500 [overflow-wrap:anywhere]">
          {description}
        </p>
      )}
    </div>
  );
}
