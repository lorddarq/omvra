import { useState } from 'react';
import { Person, Task, TaskStatus } from '../types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Edit2, Plus, User, Trash2 } from 'lucide-react';

interface PeoplePanelProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  tasks: Task[];
  statusColumns: Array<{ id: TaskStatus; title: string; color?: string }>;
  onAddPerson: (person: Omit<Person, 'id'>) => void;
  onUpdatePerson: (personId: string, updates: Pick<Person, 'name' | 'role'>) => void;
  onDeletePerson: (personId: string) => void;
}

export function PeoplePanel({
  isOpen,
  onClose,
  people,
  tasks,
  statusColumns,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
}: PeoplePanelProps) {
  const SIZE_WEIGHTS: Record<string, number> = { xs: 1, s: 2, m: 3, l: 5 };
  const STATE_WEIGHTS: Record<string, number> = {
    open: 0.4,
    'in-progress': 1.0,
    'under-review': 0.7,
    done: 0.2,
    blocked: 1.4,
  };
  const COMPLEXITY_WEIGHTS: Record<string, number> = {
    routine: 1.0,
    medium: 1.2,
    hard: 1.5,
  };
  const BLOCKED_MULTIPLIER = 1.3;
  const CAPACITY_POINTS = 12;

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');

  function getTaskCountForPerson(personId: string, status?: TaskStatus): number {
    return tasks.filter(t => {
      const matchesPerson = t.assigneeId === personId;
      const matchesStatus = status ? t.status === status : true;
      return matchesPerson && matchesStatus;
    }).length;
  }

  function getTaskLoad(task: Task): number {
    const sizeWeight = SIZE_WEIGHTS[task.size || 'm'] || 3;
    const stateWeight = STATE_WEIGHTS[task.status] || 1.0;
    const complexityWeight = COMPLEXITY_WEIGHTS[task.complexity || 'medium'] || 1.2;
    const blockedWeight = task.blocked ? BLOCKED_MULTIPLIER : 1.0;
    return sizeWeight * stateWeight * complexityWeight * blockedWeight;
  }

  function getLoadPercentageForPerson(personId: string): number {
    const personTasks = tasks.filter(t => t.assigneeId === personId);
    const totalLoad = personTasks.reduce((sum, task) => sum + getTaskLoad(task), 0);
    return Math.round((totalLoad / CAPACITY_POINTS) * 100);
  }

  function handleAddPerson() {
    if (!newName.trim()) return;
    onAddPerson({ name: newName.trim(), role: newRole.trim() || 'Team Member' });
    setNewName('');
    setNewRole('');
    setIsAdding(false);
  }

  function startEditPerson(person: Person) {
    setEditingPersonId(person.id);
    setEditName(person.name);
    setEditRole(person.role);
  }

  function cancelEditPerson() {
    setEditingPersonId(null);
    setEditName('');
    setEditRole('');
  }

  function saveEditedPerson(personId: string) {
    if (!editName.trim()) return;
    onUpdatePerson(personId, {
      name: editName.trim(),
      role: editRole.trim() || 'Team Member',
    });
    cancelEditPerson();
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="px-6">
          <SheetTitle>Team Members</SheetTitle>
          <SheetDescription>
            View and manage team members and their task assignments.
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
              <div className="flex gap-2">
                <Button onClick={handleAddPerson} size="sm">Add</Button>
                <Button onClick={() => { setIsAdding(false); setNewName(''); setNewRole(''); }} variant="outline" size="sm">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setIsAdding(true)} className="w-full" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Team Member
            </Button>
          )}

          {/* People list */}
          <div className="space-y-3">
            {people.map(person => {
              const totalTasks = getTaskCountForPerson(person.id);
              const isEditing = editingPersonId === person.id;
              const loadPercentage = getLoadPercentageForPerson(person.id);
              const loadColorClass =
                loadPercentage > 120
                  ? 'text-red-600'
                  : loadPercentage >= 80
                    ? 'text-amber-600'
                    : 'text-emerald-600';
              
              return (
                <div key={person.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
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
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">{person.name}</div>
                          <div className="text-sm text-gray-500">{person.role}</div>
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
                      return (
                        <div
                          key={col.id}
                          className="text-xs px-2 py-1 rounded text-white"
                          style={{ backgroundColor: col.color || '#9ca3af' }}
                        >
                          {col.title}: {count}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <div className={`text-sm font-semibold ${loadColorClass}`}>
                      Load: {loadPercentage}%
                    </div>
                  </div>
                </div>
              );
            })}

            {people.length === 0 && !isAdding && (
              <div className="text-center py-8 text-gray-500">
                No team members yet. Click "Add Team Member" to get started.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
