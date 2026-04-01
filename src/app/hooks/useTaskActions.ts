import { useCallback } from 'react';
import type { Person, Task, TaskComment, TaskStatus } from '../types.ts';

interface UseTaskActionsOptions {
  people: Person[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

export function useTaskActions({ people, setTasks }: UseTaskActionsOptions) {
  const saveTask = useCallback((taskData: Partial<Task>) => {
    if (taskData.id) {
      setTasks(prevTasks => prevTasks.map(t => (t.id === taskData.id ? { ...t, ...taskData } : t)));
      return;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title: taskData.title!,
      status: taskData.status || 'open',
      notes: taskData.notes,
      size: taskData.size || 'm',
      complexity: taskData.complexity || 'medium',
      blocked: Boolean(taskData.blocked),
      priority: taskData.priority || 'normal',
      startDate: taskData.startDate,
      endDate: taskData.endDate,
      projectIds: taskData.projectIds || [],
      project: taskData.project,
      swimlaneOnly: taskData.swimlaneOnly,
      swimlaneId: taskData.swimlaneId,
      assigneeId: taskData.assigneeId,
      comments: taskData.comments || [],
    };

    setTasks(prevTasks => [newTask, ...prevTasks]);
  }, [setTasks]);

  const addTaskComment = useCallback((taskId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const nextComment: TaskComment = {
      id: `comment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      author: 'You',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setTasks(prevTasks => prevTasks.map(task => (
      task.id === taskId
        ? { ...task, comments: [...(task.comments || []), nextComment] }
        : task
    )));
  }, [setTasks]);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
  }, [setTasks]);

  const moveTask = useCallback((taskId: string, newStatus: TaskStatus) => {
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));
  }, [setTasks]);

  const moveAgentTaskToReview = useCallback((taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id !== taskId) return task;
        if (task.status !== 'in-progress') return task;
        const assignee = task.assigneeId ? people.find(person => person.id === task.assigneeId) : null;
        if (!assignee || assignee.kind !== 'agentic') return task;
        return { ...task, status: 'under-review' };
      })
    );
  }, [people, setTasks]);

  const updateTaskDates = useCallback((taskId: string, startDate: string, endDate: string) => {
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? { ...t, startDate, endDate } : t)));
  }, [setTasks]);

  return {
    saveTask,
    addTaskComment,
    deleteTask,
    moveTask,
    moveAgentTaskToReview,
    updateTaskDates,
  };
}
