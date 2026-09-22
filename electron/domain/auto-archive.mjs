export function normalizeAutoArchivePolicy(value) {
  const mode = value?.mode === 'after-completion' || value?.mode === 'on-completion' ? value.mode : 'off';
  return {
    mode,
    days: Number.isInteger(value?.days) && value.days >= 1 && value.days <= 36500 ? value.days : 365,
    enabledAt: typeof value?.enabledAt === 'string' && Number.isFinite(Date.parse(value.enabledAt)) ? value.enabledAt : undefined,
  };
}

export function getBlockedArchiveTaskIds(tasks, requestedIds) {
  const active = new Map(tasks.filter(task => task.archived !== true).map(task => [task.id, task]));
  const neighbors = new Map();
  for (const task of active.values()) {
    for (const id of task.dependencyIds || []) {
      if (!active.has(id)) continue;
      if (!neighbors.has(task.id)) neighbors.set(task.id, new Set());
      if (!neighbors.has(id)) neighbors.set(id, new Set());
      neighbors.get(task.id).add(id);
      neighbors.get(id).add(task.id);
    }
  }
  const blocked = new Set();
  const queue = [...active.keys()].filter(id => !requestedIds.has(id));
  for (let index = 0; index < queue.length; index += 1) {
    for (const id of neighbors.get(queue[index]) || []) {
      if (!requestedIds.has(id) || blocked.has(id)) continue;
      blocked.add(id);
      queue.push(id);
    }
  }
  return blocked;
}

export function reconcileAutoArchive(tasks, previousTasks, columns, rawPolicy, now = Date.now(), busyTaskIds = new Set()) {
  const policy = normalizeAutoArchivePolicy(rawPolicy);
  const previousById = new Map(previousTasks.map(task => [task.id, task]));
  const complete = status => (columns.find(column => column.id === status)?.roadmapStage ?? (status === 'done' ? 'complete' : undefined)) === 'complete';
  const timestamp = new Date(now).toISOString();
  let changed = false;
  const prepared = tasks.map(task => {
    const previous = previousById.get(task.id);
    let next = task;
    if (previous && previous.status !== task.status && complete(task.status) && !complete(previous.status)) {
      next = { ...task, completedAt: timestamp, autoArchiveSuppressed: undefined };
    } else if (!complete(task.status) && (task.completedAt || task.autoArchiveSuppressed)) {
      next = { ...task, completedAt: undefined, autoArchiveSuppressed: undefined };
    }
    if (previous?.archived && !task.archived && !next.autoArchiveSuppressed) {
      next = { ...next, autoArchiveSuppressed: true };
    }
    changed ||= next !== task;
    return next;
  });
  const candidates = new Set();
  if (policy.mode !== 'off') {
    for (const task of prepared) {
      if (task.archived || task.autoArchiveSuppressed || task.blocked || !complete(task.status) || busyTaskIds.has(task.id)) continue;
      if (task.collaboration?.contributions?.some(item => item.state === 'working' || item.state === 'submitted')) continue;
      if (policy.mode === 'after-completion') {
        const completed = Date.parse(task.completedAt);
        if (!Number.isFinite(completed) || now - completed < policy.days * 86400000) continue;
      }
      candidates.add(task.id);
    }
  }
  const blocked = candidates.size ? getBlockedArchiveTaskIds(prepared, candidates) : new Set();
  const result = prepared.map((task, index) => {
    let next = task;
    if (candidates.has(task.id) && !blocked.has(task.id)) {
      next = { ...task, archived: true, archivedAt: timestamp };
    }
    if (next === tasks[index]) return next;
    changed = true;
    return { ...next, __mcpRevision: (Number(task.__mcpRevision) || 0) + 1 };
  });
  return changed ? result : tasks;
}
