import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Bot, Edit2, Trash2, Users } from 'lucide-react';
import type { Person, PersonKind, StatusColumn, Task, TaskStatus } from '../types';
import { getLoadPercentageForTasks } from '../utils/taskLoad';
import { AnchoredPanelSection } from './AnchoredPanel';
import { AgentCard, PersonCard } from './PersonCards';
import { AgentEditorCard, PersonEditorCard } from './PersonEditorCards';
import { PersonLoadSummary } from './PersonLoadSummary';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface PeopleManagementSectionsProps {
  people: Person[];
  tasks: Task[];
  statusColumns: StatusColumn[];
  executionLoadStatusId: TaskStatus;
  pipelineLoadStatusId: TaskStatus;
  onAddPerson: (person: Omit<Person, 'id'>) => void;
  onUpdatePerson: (personId: string, updates: Pick<Person, 'name' | 'role' | 'kind' | 'agentInstructions'>) => void;
  onDeletePerson: (personId: string) => void;
}

type AddSection = 'people' | 'agents';

export function PeopleManagementSections({
  people,
  tasks,
  statusColumns,
  executionLoadStatusId,
  pipelineLoadStatusId,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
}: PeopleManagementSectionsProps) {
  const [addingSection, setAddingSection] = useState<AddSection | null>(null);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newKind, setNewKind] = useState<PersonKind>('human');
  const [newAgentInstructions, setNewAgentInstructions] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editKind, setEditKind] = useState<PersonKind>('human');
  const [editAgentInstructions, setEditAgentInstructions] = useState('');

  function getTaskCountForPerson(personId: string, status?: string): number {
    return tasks.filter(task => {
      const matchesPerson = task.assigneeId === personId;
      const matchesStatus = status ? task.status === status : true;
      return matchesPerson && matchesStatus;
    }).length;
  }

  function getLoadPercentageForPerson(personId: string, statusId: string): number {
    const personTasks = tasks.filter(task => task.assigneeId === personId && task.status === statusId);
    return getLoadPercentageForTasks(personTasks);
  }

  function resetAddForm(nextKind: PersonKind = 'human') {
    setNewName('');
    setNewRole('');
    setNewKind(nextKind);
    setNewAgentInstructions('');
  }

  function startAdd(section: AddSection) {
    setAddingSection(section);
    resetAddForm(section === 'agents' ? 'agentic' : 'human');
  }

  function setAddOpen(section: AddSection, open: boolean) {
    if (open) {
      startAdd(section);
      return;
    }
    cancelAdd();
  }

  function cancelAdd() {
    setAddingSection(null);
    resetAddForm();
  }

  function handleAddPerson() {
    if (!newName.trim()) return;
    onAddPerson({
      name: newName.trim(),
      role: newRole.trim() || 'Team Member',
      kind: newKind,
      agentInstructions: newKind === 'agentic' ? newAgentInstructions.trim() || undefined : undefined,
    });
    cancelAdd();
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

  function renderPersonItem(person: Person) {
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
      <div key={person.id} className="rounded-lg border p-4 transition-colors hover:bg-gray-50">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
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
          <div className="flex shrink-0 items-center gap-1">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  onClick={() => saveEditedPerson(person.id)}
                  size="sm"
                  disabled={!editName.trim()}
                >
                  Save
                </Button>
                <Button type="button" onClick={cancelEditPerson} variant="outline" size="sm">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={() => startEditPerson(person)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-700"
                  aria-label={`Edit ${person.name}`}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  onClick={() => onDeletePerson(person.id)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-600"
                  aria-label={`Delete ${person.name}`}
                >
                  <Trash2 className="h-4 w-4" />
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
  }

  return (
    <>
      <PeopleSettingsSection
        empty={humanPeople.length === 0}
        popupOpen={addingSection === 'people'}
        action={(
          <AddPersonPopover
            open={addingSection === 'people'}
            name={newName}
            role={newRole}
            onOpenChange={(open) => setAddOpen('people', open)}
            onNameChange={setNewName}
            onRoleChange={setNewRole}
            onCancel={cancelAdd}
            onSubmit={handleAddPerson}
          />
        )}
      >
        <div className="space-y-3">
          {humanPeople.map(renderPersonItem)}
        </div>
      </PeopleSettingsSection>

      <AgentsSettingsSection
        empty={agenticPeople.length === 0}
        popupOpen={addingSection === 'agents'}
        action={(
          <AddAgentPopover
            open={addingSection === 'agents'}
            name={newName}
            role={newRole}
            agentInstructions={newAgentInstructions}
            onOpenChange={(open) => setAddOpen('agents', open)}
            onNameChange={setNewName}
            onRoleChange={setNewRole}
            onAgentInstructionsChange={setNewAgentInstructions}
            onCancel={cancelAdd}
            onSubmit={handleAddPerson}
          />
        )}
      >
        <div className="space-y-3">
          {agenticPeople.map(renderPersonItem)}
        </div>
      </AgentsSettingsSection>
    </>
  );
}

interface AddPersonPopoverProps {
  open: boolean;
  name: string;
  role: string;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onRoleChange: (role: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function AddPersonPopover({
  open,
  name,
  role,
  onOpenChange,
  onNameChange,
  onRoleChange,
  onCancel,
  onSubmit,
}: AddPersonPopoverProps) {
  return (
    <SettingsAddPopupShell open={open} onOpenChange={onOpenChange}>
      <SettingsAddPopupTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(!open)}
          className="h-auto px-0 py-0 text-xs font-semibold text-[#1a60cb] hover:bg-transparent hover:text-[#1a60cb]"
        >
          Add Person
        </Button>
      </SettingsAddPopupTrigger>
      <SettingsAddPopupContent open={open}>
        <div className="grid gap-3 px-4 pb-[18px] pt-4 sm:grid-cols-2">
          <SettingsPopoverField
            id="settings-person-name"
            label="Name"
            value={name}
            placeholder="Enter name..."
            autoFocus
            onChange={onNameChange}
          />
          <SettingsPopoverField
            id="settings-person-role"
            label="Role"
            value={role}
            placeholder="Enter role..."
            onChange={onRoleChange}
          />
        </div>
        <SettingsPopoverActions
          addDisabled={!name.trim()}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </SettingsAddPopupContent>
    </SettingsAddPopupShell>
  );
}

interface AddAgentPopoverProps {
  open: boolean;
  name: string;
  role: string;
  agentInstructions: string;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onRoleChange: (role: string) => void;
  onAgentInstructionsChange: (instructions: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function AddAgentPopover({
  open,
  name,
  role,
  agentInstructions,
  onOpenChange,
  onNameChange,
  onRoleChange,
  onAgentInstructionsChange,
  onCancel,
  onSubmit,
}: AddAgentPopoverProps) {
  return (
    <SettingsAddPopupShell open={open} onOpenChange={onOpenChange}>
      <SettingsAddPopupTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(!open)}
          className="h-auto px-0 py-0 text-xs font-semibold text-[#1a60cb] hover:bg-transparent hover:text-[#1a60cb]"
        >
          Add Agent
        </Button>
      </SettingsAddPopupTrigger>
      <SettingsAddPopupContent open={open}>
        <div className="grid gap-3 px-4 pb-5 pt-4 sm:grid-cols-2">
          <SettingsPopoverField
            id="settings-agent-name"
            label="Name"
            value={name}
            placeholder="Enter name..."
            autoFocus
            onChange={onNameChange}
          />
          <div className="space-y-1">
            <Label htmlFor="settings-agent-kind" className="text-xs font-medium leading-5 text-[#71717a]">
              Type
            </Label>
            <div
              id="settings-agent-kind"
              className="flex h-8 items-center gap-1 rounded-xl bg-white px-2 text-sm font-medium text-[#67676f] shadow-[0_0_1px_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]"
            >
              <Bot className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Agentic</span>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <SettingsPopoverField
            id="settings-agent-role"
            label="Role"
            value={role}
            placeholder="Enter role..."
            onChange={onRoleChange}
          />
        </div>
        <div className="space-y-2 px-4 pb-5">
          <Label htmlFor="settings-agent-instructions" className="text-xs font-medium leading-5 text-[#71717a]">
            Optional Prompt
          </Label>
          <Textarea
            id="settings-agent-instructions"
            value={agentInstructions}
            onChange={(event) => onAgentInstructionsChange(event.target.value)}
            placeholder="Enter prompt..."
            className="min-h-[125px] resize-none rounded-xl border-black/10 bg-white/10 p-3 text-sm placeholder:text-[#b5b5ba] focus-visible:ring-gray-300"
          />
        </div>
        <SettingsPopoverActions
          addDisabled={!name.trim()}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </SettingsAddPopupContent>
    </SettingsAddPopupShell>
  );
}

interface SettingsAddPopupShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

function SettingsAddPopupShell({ open, onOpenChange, children }: SettingsAddPopupShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!shellRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onOpenChange, open]);

  return (
    <div ref={shellRef} className="relative">
      {children}
    </div>
  );
}

function SettingsAddPopupTrigger({ children }: { children: ReactNode }) {
  return <div className="flex justify-end">{children}</div>;
}

function SettingsAddPopupContent({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;

  return (
    <div className="absolute right-0 top-[34px] z-[120] w-[min(calc(100vw-2rem),365px)] rounded-xl border border-black/15 bg-white p-0 shadow-[0_2px_4px_rgba(0,0,0,0.10),0_2px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.06),0_0_20.5px_rgba(0,0,0,0.10)]">
      <PopoverArrow />
      {children}
    </div>
  );
}

interface SettingsPopoverFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}

function SettingsPopoverField({
  id,
  label,
  value,
  placeholder,
  autoFocus = false,
  onChange,
}: SettingsPopoverFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium leading-5 text-[#71717a]">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-8 rounded-xl border-black/10 bg-white/10 px-2 text-sm placeholder:text-[#b5b5ba] focus-visible:ring-gray-300"
      />
    </div>
  );
}

interface SettingsPopoverActionsProps {
  addDisabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function SettingsPopoverActions({ addDisabled, onCancel, onSubmit }: SettingsPopoverActionsProps) {
  return (
    <div className="flex justify-end gap-2 border-t border-zinc-500/10 px-4 py-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCancel}
        className="h-7 rounded-xl border-black/10 px-3 text-sm font-medium text-[#67676f]"
      >
        Cancel
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onSubmit}
        disabled={addDisabled}
        className="h-7 rounded-xl bg-zinc-500/15 px-3 text-sm font-medium text-[#67676f] hover:bg-zinc-500/20 disabled:opacity-50"
      >
        Add
      </Button>
    </div>
  );
}

function PopoverArrow() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-[7px] right-10 size-3.5 rotate-45 border-l border-t border-black/15 bg-white"
    />
  );
}

interface PeopleSettingsSectionProps {
  children: ReactNode;
  empty?: boolean;
  action?: ReactNode;
  popupOpen?: boolean;
}

interface SettingsEmptyStateProps {
  icon: ReactNode;
  label: string;
}

function SettingsEmptyState({ icon, label }: SettingsEmptyStateProps) {
  return (
    <div className="flex h-20 items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed border-black/20 bg-zinc-500/5 p-3 text-xs text-[#6a7282]">
      <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      <span className="leading-4">{label}</span>
    </div>
  );
}

export function PeopleSettingsSection({ children, empty = false, action, popupOpen = false }: PeopleSettingsSectionProps) {
  return (
    <AnchoredPanelSection
      id="people"
      title="People"
      description="The information below is used to calculate individual person and agentic load, for better capacity management."
      className={popupOpen ? 'relative z-[100]' : 'relative z-0'}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold leading-5 text-[#71717a]">Active People</h4>
            {action}
          </div>
          <p className="text-xs leading-4 text-[#6a7282]">Manage humans for task assignment.</p>
        </div>
        {empty ? (
          <SettingsEmptyState icon={<Users className="size-4" />} label="No people available" />
        ) : children}
      </div>
    </AnchoredPanelSection>
  );
}

export function AgentsSettingsSection({ children, empty = false, action, popupOpen = false }: PeopleSettingsSectionProps) {
  return (
    <AnchoredPanelSection
      id="agents"
      title="Agents"
      description="The information below is used to calculate individual person and agentic load, for better capacity management."
      className={popupOpen ? 'relative z-[100]' : 'relative z-0'}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold leading-5 text-[#71717a]">Active Agents</h4>
            {action}
          </div>
          <p className="text-xs leading-4 text-[#6a7282]">Manage agentic sub-agents for task assignment.</p>
        </div>
        {empty ? (
          <SettingsEmptyState icon={<Bot className="size-4" />} label="No agents available" />
        ) : children}
      </div>
    </AnchoredPanelSection>
  );
}
