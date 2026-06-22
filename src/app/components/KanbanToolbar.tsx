import type { ReactNode } from 'react';
import { Filter, Plus, Search, X } from 'lucide-react';
import type { Person, TaskPriority, TimelineSwimlane } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { UNASSIGNED_ASSIGNEE_FILTER_VALUE, type KanbanTaskFilterKey } from '../utils/taskFilters';

const ALL_FILTER_VALUE = '__omvra_all__';

const PRIORITY_FILTERS: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

interface KanbanToolbarProps {
  searchQuery: string;
  projectFilterValue: string;
  priorityFilterValue: string;
  assigneeFilterValue: string;
  hasActiveFilters: boolean;
  activeProjectId?: string;
  activePriority?: string;
  activeAssigneeId?: string;
  projects: TimelineSwimlane[];
  people: Person[];
  onSearchQueryChange: (value: string) => void;
  onFilterValueChange: (key: KanbanTaskFilterKey, value: string) => void;
  onClearFilter: (key: KanbanTaskFilterKey) => void;
  onClearAllFilters: () => void;
  onAddColumn?: () => void;
}

export function KanbanToolbar({
  searchQuery,
  projectFilterValue,
  priorityFilterValue,
  assigneeFilterValue,
  hasActiveFilters,
  activeProjectId,
  activePriority,
  activeAssigneeId,
  projects,
  people,
  onSearchQueryChange,
  onFilterValueChange,
  onClearFilter,
  onClearAllFilters,
  onAddColumn,
}: KanbanToolbarProps) {
  return (
    <div className="kanban-toolbar">
      <div className="kanban-toolbar-search">
        <Search className="kanban-toolbar-search-icon" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search tasks..."
          className="kanban-toolbar-search-input"
        />
      </div>

      <div className="kanban-toolbar-actions">
        <KanbanFilterSelect
          value={projectFilterValue}
          active={Boolean(activeProjectId)}
          placeholder="Project"
          onValueChange={(value) => onFilterValueChange('projectId', value)}
          onClear={() => onClearFilter('projectId')}
        >
          <SelectItem value={ALL_FILTER_VALUE}>All projects</SelectItem>
          {projects.map(project => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </KanbanFilterSelect>

        <KanbanFilterSelect
          value={priorityFilterValue}
          active={Boolean(activePriority)}
          placeholder="Priority"
          onValueChange={(value) => onFilterValueChange('priority', value)}
          onClear={() => onClearFilter('priority')}
        >
          <SelectItem value={ALL_FILTER_VALUE}>All priorities</SelectItem>
          {PRIORITY_FILTERS.map(priority => (
            <SelectItem key={priority.value} value={priority.value}>
              {priority.label}
            </SelectItem>
          ))}
        </KanbanFilterSelect>

        <KanbanFilterSelect
          value={assigneeFilterValue}
          active={Boolean(activeAssigneeId)}
          placeholder="Assignee"
          onValueChange={(value) => onFilterValueChange('assigneeId', value)}
          onClear={() => onClearFilter('assigneeId')}
        >
          <SelectItem value={ALL_FILTER_VALUE}>All assignees</SelectItem>
          <SelectItem value={UNASSIGNED_ASSIGNEE_FILTER_VALUE}>Unassigned</SelectItem>
          {people.map(person => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </KanbanFilterSelect>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearAllFilters}
            className="kanban-toolbar-clear"
          >
            <Filter className="size-4" />
            Clear
          </Button>
        )}

        <button
          type="button"
          onClick={onAddColumn}
          className="kanban-toolbar-add-board"
          disabled={!onAddColumn}
        >
          <Plus className="size-4" />
          <span>Add Board</span>
        </button>
      </div>
    </div>
  );
}

interface KanbanFilterSelectProps {
  value: string;
  active: boolean;
  placeholder: string;
  children: ReactNode;
  onValueChange: (value: string) => void;
  onClear: () => void;
}

function KanbanFilterSelect({
  value,
  active,
  placeholder,
  children,
  onValueChange,
  onClear,
}: KanbanFilterSelectProps) {
  return (
    <div className="kanban-filter-control">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className={`kanban-filter-trigger ${active ? 'is-active' : ''}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {active && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="kanban-filter-clear"
          aria-label={`Clear ${placeholder.toLowerCase()} filter`}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

export { ALL_FILTER_VALUE };
