import { formatDateRangeLabel } from '../utils/dateRange';

interface DateRangeLabelProps {
  startDate?: string | null;
  endDate?: string | null;
  className?: string;
}

export function DateRangeLabel({ startDate, endDate, className = '' }: DateRangeLabelProps) {
  return (
    <span className={className}>
      {formatDateRangeLabel(startDate, endDate)}
    </span>
  );
}
