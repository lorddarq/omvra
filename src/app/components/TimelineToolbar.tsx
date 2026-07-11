import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { TodayButton } from './TodayButton';

interface TimelineToolbarProps {
  mode: 'projects' | 'people';
  showWeekends: boolean;
  showCompleted: boolean;
  onModeChange: (mode: 'projects' | 'people') => void;
  onShowWeekendsChange: (showWeekends: boolean) => void;
  onShowCompletedChange: (showCompleted: boolean) => void;
  onScrollLeft: () => void;
  onScrollRight: () => void;
  onScrollToToday: () => void;
}

export function TimelineToolbar({
  mode,
  showWeekends,
  showCompleted,
  onModeChange,
  onShowWeekendsChange,
  onShowCompletedChange,
  onScrollLeft,
  onScrollRight,
  onScrollToToday,
}: TimelineToolbarProps) {
  return (
    <div className="timeline-toolbar">
      <div className="timeline-mode-toggle" role="tablist" aria-label="Timeline mode">
        <button
          type="button"
          onClick={() => onShowCompletedChange(!showCompleted)}
          className={`timeline-week-toggle ${showCompleted ? 'is-seven-day' : 'is-five-day'}`}
          title={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
          aria-pressed={showCompleted}
        >
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>

        <button
          type="button"
          onClick={() => onModeChange('projects')}
          className={`timeline-mode-button ${mode === 'projects' ? 'active' : 'inactive'}`}
          role="tab"
          aria-selected={mode === 'projects'}
          aria-label="Projects"
          title="Projects"
        >
          <HeroCalendarIcon />
        </button>
        <button
          type="button"
          onClick={() => onModeChange('people')}
          className={`timeline-mode-button ${mode === 'people' ? 'active' : 'inactive'}`}
          role="tab"
          aria-selected={mode === 'people'}
          aria-label="People"
          title="People"
        >
          <Users className="h-4 w-4" />
        </button>
      </div>

      <h3 className="timeline-toolbar-title">{mode === 'people' ? 'People' : 'Projects'}</h3>

      <div className="timeline-toolbar-actions">
        <div className="timeline-toolbar-controls" aria-label="Timeline navigation">
          <button
            type="button"
            onClick={onScrollLeft}
            className="timeline-icon-button timeline-icon-button-left"
            aria-label="Scroll timeline left"
            title="Scroll timeline left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <TodayButton onClick={onScrollToToday} />
          <button
            type="button"
            onClick={onScrollRight}
            className="timeline-icon-button timeline-icon-button-right"
            aria-label="Scroll timeline right"
            title="Scroll timeline right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onShowWeekendsChange(!showWeekends)}
          className={`timeline-week-toggle ${showWeekends ? 'is-seven-day' : 'is-five-day'}`}
          title={showWeekends ? 'Hide weekends' : 'Show weekends'}
          aria-pressed={!showWeekends}
        >
          {showWeekends ? '7 days' : '5 days'}
        </button>
      </div>
    </div>
  );
}

function HeroCalendarIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5A2.25 2.25 0 0 1 5.25 5.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
