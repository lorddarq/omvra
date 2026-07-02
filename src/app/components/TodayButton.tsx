interface TodayButtonProps {
  onClick: () => void;
  label?: string;
}

export function TodayButton({ onClick, label = 'Today' }: TodayButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="timeline-toolbar-button-primary"
    >
      {label}
    </button>
  );
}
