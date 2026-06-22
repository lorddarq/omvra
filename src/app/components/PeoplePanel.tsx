import { Person, Task, TaskStatus, StatusColumn } from '../types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { PeopleManagementSections } from './PeopleSettingsSections';

interface PeoplePanelProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  tasks: Task[];
  statusColumns: StatusColumn[];
  executionLoadStatusIds: TaskStatus[];
  pipelineLoadStatusIds: TaskStatus[];
  onAddPerson: (person: Omit<Person, 'id'>) => void;
  onUpdatePerson: (personId: string, updates: Pick<Person, 'name' | 'role' | 'kind' | 'agentInstructions'>) => void;
  onDeletePerson: (personId: string) => void;
}

export function PeoplePanel({
  isOpen,
  onClose,
  people,
  tasks,
  statusColumns,
  executionLoadStatusIds,
  pipelineLoadStatusIds,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
}: PeoplePanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[540px]">
        <SheetHeader className="px-6">
          <SheetTitle>People</SheetTitle>
          <SheetDescription>
            Manage humans and agentic sub-agents for task assignment.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-6">
          <PeopleManagementSections
            people={people}
            tasks={tasks}
            statusColumns={statusColumns}
            executionLoadStatusIds={executionLoadStatusIds}
            pipelineLoadStatusIds={pipelineLoadStatusIds}
            onAddPerson={onAddPerson}
            onUpdatePerson={onUpdatePerson}
            onDeletePerson={onDeletePerson}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
