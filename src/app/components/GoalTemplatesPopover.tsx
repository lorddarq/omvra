import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import type { GoalTemplate } from '../data/goalTemplates.ts';
import { AwardCertificateIcon } from './icons/AwardCertificateIcon';
import { DropdownChevron } from './icons/DropdownChevron';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type GoalTemplatesPopoverProps = {
  templates: GoalTemplate[];
  disabled?: boolean;
  onSelect: (template: GoalTemplate) => void;
};

export function GoalTemplatesPopover({ templates, disabled = false, onSelect }: GoalTemplatesPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative w-fit h-fit shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="relative flex w-fit h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Add a goal template"
              >
                <span className="flex items-center justify-center"><AwardCertificateIcon className="size-3.5 text-[#71717a]" /></span>
                <DropdownChevron />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>Start from a goal template</TooltipContent>
        </Tooltip>
      </div>
      <PopoverContent align="center" sideOffset={8} className="w-80 p-2">
        <div className="px-2.5 pb-2 pt-1">
          <p className="text-xs font-semibold text-slate-900">Start from a template</p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Add a ready-to-shape workflow to the canvas.</p>
        </div>
        <div className="max-h-[min(28rem,calc(100vh-10rem))] space-y-0.5 overflow-auto">
          {templates.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => { onSelect(template); setOpen(false); }}
              className="group flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="mt-0.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: template.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-slate-800">{template.title}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{template.description}</span>
              </span>
              <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-600" aria-hidden="true" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
