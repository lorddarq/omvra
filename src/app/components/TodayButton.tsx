import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface TodayButtonProps {
  onClick: () => void;
  label?: string;
  tooltip?: string;
}

export function TodayButton({ onClick, label = 'Today', tooltip = 'Scroll to today' }: TodayButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="timeline-toolbar-button-primary"
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
