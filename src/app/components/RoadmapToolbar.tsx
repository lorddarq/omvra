import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Filter, Plus, Search, X } from 'lucide-react';
import type { MilestoneHealth } from '../utils/roadmap';
import type { TimelineSwimlane } from '../types';
import { MILESTONE_HEALTH_VISUALS } from '../utils/roadmap';
import { DateRangeLabel } from './DateRangeLabel';
import { TodayButton } from './TodayButton';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export type RoadmapDateWindow = 'all' | '30' | '90' | 'overdue';

interface RoadmapToolbarProps {
  searchQuery: string;
  projectFilter: string;
  healthFilter: MilestoneHealth | 'all';
  dateWindow: RoadmapDateWindow;
  hasActiveFilters: boolean;
  projects: TimelineSwimlane[];
  rangeStart: string;
  rangeEnd: string;
  showTimelineNavigation: boolean;
  onSearchQueryChange: (value: string) => void;
  onProjectFilterChange: (value: string) => void;
  onHealthFilterChange: (value: MilestoneHealth | 'all') => void;
  onDateWindowChange: (value: RoadmapDateWindow) => void;
  onResetFilters: () => void;
  onAddMilestone: () => void;
  onScrollTimelineLeft: () => void;
  onScrollTimelineRight: () => void;
  onScrollToToday: () => void;
}

export function RoadmapToolbar({
  searchQuery,
  projectFilter,
  healthFilter,
  dateWindow,
  hasActiveFilters,
  projects,
  rangeStart,
  rangeEnd,
  showTimelineNavigation,
  onSearchQueryChange,
  onProjectFilterChange,
  onHealthFilterChange,
  onDateWindowChange,
  onResetFilters,
  onAddMilestone,
  onScrollTimelineLeft,
  onScrollTimelineRight,
  onScrollToToday,
}: RoadmapToolbarProps) {
  return (
    <div className="kanban-toolbar">
      <div className="kanban-toolbar-search">
        <Search className="kanban-toolbar-search-icon" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search milestones, projects, or linked tasks..."
          className="kanban-toolbar-search-input"
        />
      </div>
      <div className="roadmap-toolbar-center" aria-label="Roadmap date navigation">
        <DateRangeLabel startDate={rangeStart} endDate={rangeEnd} className="roadmap-toolbar-date-range" />
        {showTimelineNavigation ? (
          <div className="timeline-toolbar-controls" aria-label="Roadmap navigation">
            <button
              type="button"
              onClick={onScrollTimelineLeft}
              className="timeline-icon-button timeline-icon-button-left"
              aria-label="Scroll roadmap left"
              title="Scroll roadmap left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <TodayButton onClick={onScrollToToday} />
            <button
              type="button"
              onClick={onScrollTimelineRight}
              className="timeline-icon-button timeline-icon-button-right"
              aria-label="Scroll roadmap right"
              title="Scroll roadmap right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="kanban-toolbar-actions">
        <RoadmapFilterSelect
          value={projectFilter}
          active={projectFilter !== 'all'}
          placeholder="Project"
          clearLabel="Clear project filter"
          onValueChange={onProjectFilterChange}
          onClear={() => onProjectFilterChange('all')}
        >
          <SelectItem value="all">All projects</SelectItem>
          {projects.map(project => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </RoadmapFilterSelect>

        <RoadmapFilterSelect
          value={healthFilter}
          active={healthFilter !== 'all'}
          placeholder="Health"
          clearLabel="Clear health filter"
          onValueChange={(value) => onHealthFilterChange(value as MilestoneHealth | 'all')}
          onClear={() => onHealthFilterChange('all')}
        >
          <SelectItem value="all">All health</SelectItem>
          {(Object.keys(MILESTONE_HEALTH_VISUALS) as MilestoneHealth[]).map(health => (
            <SelectItem key={health} value={health}>
              {MILESTONE_HEALTH_VISUALS[health].label}
            </SelectItem>
          ))}
        </RoadmapFilterSelect>

        <RoadmapFilterSelect
          value={dateWindow}
          active={dateWindow !== 'all'}
          placeholder="Date"
          clearLabel="Clear date filter"
          onValueChange={(value) => onDateWindowChange(value as RoadmapDateWindow)}
          onClear={() => onDateWindowChange('all')}
        >
          <SelectItem value="all">All dates</SelectItem>
          <SelectItem value="30">Next 30 days</SelectItem>
          <SelectItem value="90">Next 90 days</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
        </RoadmapFilterSelect>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            className="kanban-toolbar-clear"
          >
            <Filter className="h-4 w-4" />
            Clear
          </Button>
        ) : null}

        <button
          type="button"
          onClick={onAddMilestone}
          className="kanban-toolbar-add-board"
        >
          <Plus className="size-4" />
          <span>Add milestone</span>
        </button>
      </div>
    </div>
  );
}

interface RoadmapFilterSelectProps {
  value: string;
  active: boolean;
  placeholder: string;
  clearLabel: string;
  children: ReactNode;
  onValueChange: (value: string) => void;
  onClear: () => void;
}

function RoadmapFilterSelect({
  value,
  active,
  placeholder,
  clearLabel,
  children,
  onValueChange,
  onClear,
}: RoadmapFilterSelectProps) {
  return (
    <div className="kanban-filter-control">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className={`kanban-filter-trigger ${active ? 'is-active' : ''}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="kanban-filter-clear"
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
