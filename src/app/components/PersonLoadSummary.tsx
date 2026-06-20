interface PersonLoadSummaryProps {
  executionLoadPercentage: number;
  pipelineLoadPercentage: number;
}

export function PersonLoadSummary({
  executionLoadPercentage,
  pipelineLoadPercentage,
}: PersonLoadSummaryProps) {
  return (
    <div className="text-right">
      <div className={`text-sm font-semibold ${getLoadColorClass(executionLoadPercentage)}`}>
        Execution: {executionLoadPercentage}%
      </div>
      <div className={`text-xs font-medium ${getLoadColorClass(pipelineLoadPercentage)}`}>
        Pipeline: {pipelineLoadPercentage}%
      </div>
    </div>
  );
}

function getLoadColorClass(percentage: number) {
  if (percentage > 120) return 'text-red-600';
  if (percentage >= 80) return 'text-amber-600';
  return 'text-emerald-600';
}
