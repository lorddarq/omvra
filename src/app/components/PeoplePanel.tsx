import { useState } from 'react';
import { Person, Task, TaskStatus } from '../types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Edit2, Plus, User, Bot, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getLoadPercentageForTasks } from '../utils/taskLoad';
import { getReadableTextClassFor } from '../utils/contrast';

interface PeoplePanelProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  tasks: Task[];
  statusColumns: Array<{ id: TaskStatus; title: string; color?: string }>;
  executionLoadStatusId: TaskStatus;
  pipelineLoadStatusId: TaskStatus;
  agentWatchConfigs: Array<{
    personId: string;
    enabled: boolean;
    statusId: string;
    projectId?: string;
    search?: string;
    action: 'inspect_only' | 'inspect_and_work' | 'move_to_ready_for_human_review';
    intervalSeconds: number;
  }>;
  agentWatchRuntime: Record<string, {
    personId: string;
    watcherId?: string;
    lastCheckedAt?: string;
    newTaskCount: number;
    updatedTaskCount: number;
    removedTaskCount: number;
    latestTaskTitles: string[];
    error?: string;
  }>;
  onAddPerson: (person: Omit<Person, 'id'>) => void;
  onUpdatePerson: (personId: string, updates: Pick<Person, 'name' | 'role' | 'kind'>) => void;
  onDeletePerson: (personId: string) => void;
  onSaveAgentWatchConfig: (config: {
    personId: string;
    enabled: boolean;
    statusId: string;
    projectId?: string;
    search?: string;
    action: 'inspect_only' | 'inspect_and_work' | 'move_to_ready_for_human_review';
    intervalSeconds: number;
  }) => void;
  onRemoveAgentWatchConfig: (personId: string) => void;
  onPollAgentWatch: (personId: string) => void;
}

export function PeoplePanel({
  isOpen,
  onClose,
  people,
  tasks,
  statusColumns,
  executionLoadStatusId,
  pipelineLoadStatusId,
  agentWatchConfigs,
  agentWatchRuntime,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
  onSaveAgentWatchConfig,
  onRemoveAgentWatchConfig,
  onPollAgentWatch,
}: PeoplePanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newKind, setNewKind] = useState<'human' | 'agentic'>('human');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editKind, setEditKind] = useState<'human' | 'agentic'>('human');

  function getAgentWatchConfig(personId: string) {
    return agentWatchConfigs.find(config => config.personId === personId) || {
      personId,
      enabled: false,
      statusId: statusColumns[0]?.id || 'open',
      action: 'inspect_and_work' as const,
      intervalSeconds: 60,
    };
  }

  function formatWatchTime(value?: string) {
    if (!value) return 'Not checked yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  function describeAgentAction(action: 'inspect_only' | 'inspect_and_work' | 'move_to_ready_for_human_review') {
    if (action === 'inspect_only') return 'Inspect only';
    if (action === 'move_to_ready_for_human_review') return 'Move done tasks to Ready for human review';
    return 'Inspect and work the task';
  }

  function getTaskCountForPerson(personId: string, status?: TaskStatus): number {
    return tasks.filter(t => {
      const matchesPerson = t.assigneeId === personId;
      const matchesStatus = status ? t.status === status : true;
      return matchesPerson && matchesStatus;
    }).length;
  }

  function getLoadPercentageForPerson(personId: string, statusId: TaskStatus): number {
    const personTasks = tasks.filter(t => t.assigneeId === personId && t.status === statusId);
    return getLoadPercentageForTasks(personTasks);
  }

  function handleAddPerson() {
    if (!newName.trim()) return;
    onAddPerson({
      name: newName.trim(),
      role: newRole.trim() || 'Team Member',
      kind: newKind,
    });
    setNewName('');
    setNewRole('');
    setNewKind('human');
    setIsAdding(false);
  }

  function startEditPerson(person: Person) {
    setEditingPersonId(person.id);
    setEditName(person.name);
    setEditRole(person.role);
    setEditKind(person.kind === 'agentic' ? 'agentic' : 'human');
  }

  function cancelEditPerson() {
    setEditingPersonId(null);
    setEditName('');
    setEditRole('');
    setEditKind('human');
  }

  function saveEditedPerson(personId: string) {
    if (!editName.trim()) return;
    onUpdatePerson(personId, {
      name: editName.trim(),
      role: editRole.trim() || 'Team Member',
      kind: editKind,
    });
    cancelEditPerson();
  }

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
              <div className="space-y-2">
                <Label htmlFor="person-name">Name</Label>
                <Input
                  id="person-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter name..."
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="person-role">Role</Label>
                <Input
                  id="person-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Enter role..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="person-kind">Type</Label>
                <Select value={newKind} onValueChange={(value) => setNewKind(value as 'human' | 'agentic')}>
                  <SelectTrigger id="person-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="human">Human</SelectItem>
                    <SelectItem value="agentic">Agentic (sub-agent)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddPerson} size="sm">Add</Button>
                <Button
                  onClick={() => {
                    setIsAdding(false);
                    setNewName('');
                    setNewRole('');
                    setNewKind('human');
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
          <div className="space-y-3">
            {people.map(person => {
              const totalTasks = getTaskCountForPerson(person.id);
              const isEditing = editingPersonId === person.id;
              const executionLoadPercentage = getLoadPercentageForPerson(person.id, executionLoadStatusId);
              const pipelineLoadPercentage = getLoadPercentageForPerson(person.id, pipelineLoadStatusId);
              const executionLoadColorClass =
                executionLoadPercentage > 120
                  ? 'text-red-600'
                  : executionLoadPercentage >= 80
                    ? 'text-amber-600'
                    : 'text-emerald-600';
              const pipelineLoadColorClass =
                pipelineLoadPercentage > 120
                  ? 'text-red-600'
                  : pipelineLoadPercentage >= 80
                    ? 'text-amber-600'
                    : 'text-emerald-600';
              const watchConfig = getAgentWatchConfig(person.id);
              const watchRuntime = agentWatchRuntime[person.id];
              
              return (
                <div key={person.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        {person.kind === 'agentic' ? (
                          <Bot className="w-5 h-5 text-blue-600" />
                        ) : (
                          <User className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Name"
                            className="h-8"
                          />
                          <Input
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            placeholder="Role"
                            className="h-8"
                          />
                          <Select value={editKind} onValueChange={(value) => setEditKind(value as 'human' | 'agentic')}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="human">Human</SelectItem>
                              <SelectItem value="agentic">Agentic (sub-agent)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">{person.name}</div>
                          <div className="text-sm text-gray-500">
                            {person.role} • {person.kind === 'agentic' ? 'Agentic' : 'Human'}
                          </div>
                        </div>
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

                  {/* Task count by status */}
                  <div className="flex flex-wrap gap-2">
                    <div className="text-xs px-2 py-1 bg-gray-100 rounded">
                      Total: {totalTasks}
                    </div>
                    {statusColumns.map(col => {
                      const count = getTaskCountForPerson(person.id, col.id);
                      if (count === 0) return null;
                      const bgColor = col.color || '#9ca3af';
                      const textClass = getReadableTextClassFor(bgColor, bgColor);
                      return (
                        <div
                          key={col.id}
                          className={`text-xs px-2 py-1 rounded ${textClass}`}
                          style={{ backgroundColor: bgColor }}
                        >
                          {col.title}: {count}
                        </div>
                      );
                    })}
                  </div>

                  {person.kind === 'agentic' && (
                    <div className="mt-4 rounded-lg border bg-gray-50 p-3 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Board watch</div>
                        <p className="text-xs text-gray-500">
                          Configure which board this agent monitors for newly assigned tasks.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Watched board</Label>
                          <Select
                            value={watchConfig.statusId}
                            onValueChange={(value) =>
                              onSaveAgentWatchConfig({
                                ...watchConfig,
                                personId: person.id,
                                statusId: value,
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select board" />
                            </SelectTrigger>
                            <SelectContent>
                              {statusColumns.map(col => (
                                <SelectItem key={col.id} value={col.id}>
                                  {col.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Action</Label>
                          <Select
                            value={watchConfig.action}
                            onValueChange={(value) =>
                              onSaveAgentWatchConfig({
                                ...watchConfig,
                                personId: person.id,
                                action: value as 'inspect_only' | 'inspect_and_work' | 'move_to_ready_for_human_review',
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select action" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inspect_only">Inspect only</SelectItem>
                              <SelectItem value="inspect_and_work">Inspect and work</SelectItem>
                              <SelectItem value="move_to_ready_for_human_review">Ready for human review</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Project filter</Label>
                          <Input
                            value={watchConfig.projectId || ''}
                            onChange={(e) =>
                              onSaveAgentWatchConfig({
                                ...watchConfig,
                                personId: person.id,
                                projectId: e.target.value.trim() || undefined,
                              })
                            }
                            placeholder="Optional project id"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Poll interval (sec)</Label>
                          <Input
                            type="number"
                            min={15}
                            max={3600}
                            value={watchConfig.intervalSeconds}
                            onChange={(e) =>
                              onSaveAgentWatchConfig({
                                ...watchConfig,
                                personId: person.id,
                                intervalSeconds: Math.max(15, Math.min(3600, Number(e.target.value) || 60)),
                              })
                            }
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Search filter</Label>
                        <Input
                          value={watchConfig.search || ''}
                          onChange={(e) =>
                            onSaveAgentWatchConfig({
                              ...watchConfig,
                              personId: person.id,
                              search: e.target.value.trim() || undefined,
                            })
                          }
                          placeholder="Optional title/description filter"
                          className="h-9"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">Watcher enabled</div>
                          <div className="text-xs text-gray-500">{describeAgentAction(watchConfig.action)}</div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={watchConfig.enabled}
                          aria-label={`Toggle watcher for ${person.name}`}
                          onClick={() =>
                            onSaveAgentWatchConfig({
                              ...watchConfig,
                              personId: person.id,
                              enabled: !watchConfig.enabled,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                            watchConfig.enabled ? 'bg-[#020329] border-[#020329]' : 'bg-gray-300 border-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              watchConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => onPollAgentWatch(person.id)}>
                          Poll now
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onRemoveAgentWatchConfig(person.id)}>
                          Reset watcher
                        </Button>
                      </div>

                      <div className="rounded-md border bg-white px-3 py-2 text-xs text-gray-600 space-y-1">
                        <p>Last checked: {formatWatchTime(watchRuntime?.lastCheckedAt)}</p>
                        <p>
                          Changes: {watchRuntime?.newTaskCount || 0} new, {watchRuntime?.updatedTaskCount || 0} updated,
                          {` ${watchRuntime?.removedTaskCount || 0} removed`}
                        </p>
                        {watchRuntime?.latestTaskTitles?.length ? (
                          <p>Latest tasks: {watchRuntime.latestTaskTitles.join(', ')}</p>
                        ) : (
                          <p>No recent watcher matches.</p>
                        )}
                        {watchRuntime?.error && (
                          <p className="text-amber-700">Watcher error: {watchRuntime.error}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${executionLoadColorClass}`}>
                        Execution: {executionLoadPercentage}%
                      </div>
                      <div className={`text-xs font-medium ${pipelineLoadColorClass}`}>
                        Pipeline: {pipelineLoadPercentage}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {people.length === 0 && !isAdding && (
              <div className="text-center py-8 text-gray-500">
                No people yet. Click "Add Person" to get started.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
