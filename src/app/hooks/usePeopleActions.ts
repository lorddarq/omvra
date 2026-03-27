import { useCallback } from 'react';
import { Person, Task } from '../types';

interface UsePeopleActionsOptions {
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onDeleteAgentWatchConfig: (personId: string) => void;
}

export function usePeopleActions({
  setPeople,
  setTasks,
  onDeleteAgentWatchConfig,
}: UsePeopleActionsOptions) {
  const addPerson = useCallback((personData: Omit<Person, 'id'>) => {
    const newPerson: Person = {
      id: Date.now().toString(),
      name: personData.name,
      role: personData.role,
      kind: personData.kind === 'agentic' ? 'agentic' : 'human',
      avatar: personData.avatar,
    };
    setPeople(prevPeople => [...prevPeople, newPerson]);
  }, [setPeople]);

  const deletePerson = useCallback((personId: string) => {
    setPeople(prevPeople => prevPeople.filter(p => p.id !== personId));
    setTasks(prevTasks => prevTasks.map(t => (t.assigneeId === personId ? { ...t, assigneeId: undefined } : t)));
    onDeleteAgentWatchConfig(personId);
  }, [onDeleteAgentWatchConfig, setPeople, setTasks]);

  const updatePerson = useCallback((personId: string, updates: Pick<Person, 'name' | 'role' | 'kind'>) => {
    setPeople(prevPeople => prevPeople.map(p => (p.id === personId ? { ...p, ...updates } : p)));
  }, [setPeople]);

  const reorderPeople = useCallback((reorderedPeople: Person[]) => {
    setPeople(reorderedPeople);
  }, [setPeople]);

  return {
    addPerson,
    deletePerson,
    updatePerson,
    reorderPeople,
  };
}
