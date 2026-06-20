import { useState } from 'react';
import { Person, Task, TaskStatus, StatusColumn } from '../types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { getLoadPercentageForTasks } from '../utils/taskLoad';
import { AgentEditorCard, PersonEditorCard } from './PersonEditorCards';
import { AgentCard, PersonCard } from './PersonCards';
import { PersonLoadSummary } from './PersonLoadSummary';
import { AgentsSettingsSection, PeopleSettingsSection } from './PeopleSettingsSections';

interface PeoplePanelProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  tasks: Task[];
  statusColumns: StatusColumn[];
  executionLoadStatusId: TaskStatus;
  pipelineLoadStatusId: TaskStatus;
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
  executionLoadStatusId,
  pipelineLoadStatusId,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
}: PeoplePanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newKind, setNewKind] = useState<'human' | 'agentic'>('human');
  const [newAgentInstructions, setNewAgentInstructions] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editKind, setEditKind] = useState<'human' | 'agentic'>('human');
  const [editAgentInstructions, setEditAgentInstructions] = useState('');

  function getTaskCountForPerson(personId: string, status?: string): number {
    return tasks.filter(t => {
      const matchesPerson = t.assigneeId === personId;
      const matchesStatus = status ? t.status === status : true;
      return matchesPerson && matchesStatus;
    }).length;
  }

  function getLoadPercentageForPerson(personId: string, statusId: string): number {
    const personTasks = tasks.filter(t => t.assigneeId === personId && t.status === statusId);
    return getLoadPercentageForTasks(personTasks);
  }

  function handleAddPerson() {
    if (!newName.trim()) return;
    onAddPerson({
      name: newName.trim(),
      role: newRole.trim() || 'Team Member',
      kind: newKind,
      agentInstructions: newKind === 'agentic' ? newAgentInstructions.trim() || undefined : undefined,
    });
    setNewName('');
    setNewRole('');
    setNewKind('human');
    setNewAgentInstructions('');
    setIsAdding(false);
  }

  function startEditPerson(person: Person) {
    setEditingPersonId(person.id);
    setEditName(person.name);
    setEditRole(person.role);
    setEditKind(person.kind === 'agentic' ? 'agentic' : 'human');
    setEditAgentInstructions(person.agentInstructions || '');
  }

  function cancelEditPerson() {
    setEditingPersonId(null);
    setEditName('');
    setEditRole('');
    setEditKind('human');
    setEditAgentInstructions('');
  }

  function saveEditedPerson(personId: string) {
    if (!editName.trim()) return;
    onUpdatePerson(personId, {
      name: editName.trim(),
      role: editRole.trim() || 'Team Member',
      kind: editKind,
      agentInstructions: editKind === 'agentic' ? editAgentInstructions.trim() || undefined : undefined,
    });
    cancelEditPerson();
  }

  const humanPeople = people.filter(person => person.kind !== 'agentic');
  const agenticPeople = people.filter(person => person.kind === 'agentic');

  const renderPersonItem = (person: Person) => {
    const totalTasks = getTaskCountForPerson(person.id);
    const isEditing = editingPersonId === person.id;
    const executionLoadPercentage = getLoadPercentageForPerson(person.id, executionLoadStatusId);
    const pipelineLoadPercentage = getLoadPercentageForPerson(person.id, pipelineLoadStatusId);
    const statusCounts = statusColumns
      .map(column => ({ column, count: getTaskCountForPerson(person.id, column.id) }))
      .filter(({ count }) => count > 0);
    const editInstructionsId = `person-agent-instructions-${person.id}`;
    const editCardProps = {
      name: editName,
      role: editRole,
      kind: editKind,
      namePlaceholder: 'Name',
      rolePlaceholder: 'Role',
      compact: true,
      onNameChange: setEditName,
      onRoleChange: setEditRole,
      onKindChange: setEditKind,
    };

    return (
      <div key={person.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div>
            {isEditing && editKind === 'agentic' ? (
              <AgentEditorCard
                {...editCardProps}
                agentInstructions={editAgentInstructions}
                agentInstructionsInputId={editInstructionsId}
                onAgentInstructionsChange={setEditAgentInstructions}
              />
            ) : isEditing ? (
              <PersonEditorCard {...editCardProps} />
            ) : person.kind === 'agentic' ? (
              <AgentCard
                person={person}
                totalTasks={totalTasks}
                statusCounts={statusCounts}
              />
            ) : (
              <PersonCard
                person={person}
                totalTasks={totalTasks}
                statusCounts={statusCounts}
              />
            )}
          </div>
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button onClick={() => saveEditedPerson(person.id)} size="sm">Save</Button>
                <Button onClick={cancelEditPerson} variant="outline" size="sm">Cancel</Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => startEditPerson(person)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-700"
                  aria-label="Edit person"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => onDeletePerson(person.id)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-600"
                  aria-label="Delete person"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <PersonLoadSummary
            executionLoadPercentage={executionLoadPercentage}
            pipelineLoadPercentage={pipelineLoadPercentage}
          />
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="px-6">
          <SheetTitle>People</SheetTitle>
          <SheetDescription>
            Manage humans and agentic sub-agents for task assignment.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-6 space-y-4">{/* Add new person */}
          {/* Add new person */}
          {isAdding ? (
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              {newKind === 'agentic' && (
                <AgentEditorCard
                  name={newName}
                  role={newRole}
                  kind={newKind}
                  agentInstructions={newAgentInstructions}
                  nameInputId="person-name"
                  roleInputId="person-role"
                  kindInputId="person-kind"
                  agentInstructionsInputId="person-agent-instructions"
                  namePlaceholder="Enter name..."
                  rolePlaceholder="Enter role..."
                  autoFocus
                  onNameChange={setNewName}
                  onRoleChange={setNewRole}
                  onKindChange={setNewKind}
                  onAgentInstructionsChange={setNewAgentInstructions}
                />
              )}
              {newKind === 'human' && (
                <PersonEditorCard
                  name={newName}
                  role={newRole}
                  kind={newKind}
                  nameInputId="person-name"
                  roleInputId="person-role"
                  kindInputId="person-kind"
                  namePlaceholder="Enter name..."
                  rolePlaceholder="Enter role..."
                  autoFocus
                  onNameChange={setNewName}
                  onRoleChange={setNewRole}
                  onKindChange={setNewKind}
                />
              )}
              <div className="flex gap-2">
                <Button onClick={handleAddPerson} size="sm">Add</Button>
                <Button
                  onClick={() => {
                    setIsAdding(false);
                    setNewName('');
                    setNewRole('');
                    setNewKind('human');
                    setNewAgentInstructions('');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setIsAdding(true)} className="w-full" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Person
            </Button>
          )}

          {/* People list */}
          <div className="space-y-5">
            <PeopleSettingsSection empty={humanPeople.length === 0 && !isAdding}>
              <div className="space-y-3">
                {humanPeople.map(renderPersonItem)}
              </div>
            </PeopleSettingsSection>

            <AgentsSettingsSection empty={agenticPeople.length === 0}>
              <div className="space-y-3">
                {agenticPeople.map(renderPersonItem)}
              </div>
            </AgentsSettingsSection>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
