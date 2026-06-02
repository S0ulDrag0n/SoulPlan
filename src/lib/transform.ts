import type {
  BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow,
} from './db/types';
import type {
  Board, Release, Sprint, Task, Dependency, BoardState,
  SprintWithTasks,
} from './types';

// ─── Row → Model transforms (pure functions) ────────────────

export function toBoard(row: BoardRow): Board {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRelease(row: ReleaseRow): Release {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    position: row.position,
    targetDate: row.target_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function toSprint(row: SprintRow): Sprint {
  return {
    id: row.id,
    releaseId: row.release_id,
    name: row.name,
    position: row.position,
    capacity: row.capacity,
    capacityUnit: row.capacity_unit,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    sprintId: row.sprint_id,
    title: row.title,
    description: row.description,
    estimate: row.estimate,
    color: row.color,
    isCritical: row.is_critical === 1,
    position: row.position,
    createdAt: row.created_at,
  };
}

export function toDependency(row: DependencyRow): Dependency {
  return {
    id: row.id,
    fromTaskId: row.from_task_id,
    toTaskId: row.to_task_id,
    createdAt: row.created_at,
  };
}

// ─── Model → DB column transforms (pure functions) ───────────

export function taskToRow(task: Partial<Task> & { id: string }): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (task.title !== undefined) row.title = task.title;
  if (task.description !== undefined) row.description = task.description;
  if (task.estimate !== undefined) row.estimate = task.estimate;
  if (task.color !== undefined) row.color = task.color;
  if (task.isCritical !== undefined) row.is_critical = task.isCritical ? 1 : 0;
  if (task.sprintId !== undefined) row.sprint_id = task.sprintId;
  if (task.position !== undefined) row.position = task.position;
  return row;
}

export function sprintToRow(sprint: Partial<Sprint> & { id: string }): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (sprint.name !== undefined) row.name = sprint.name;
  if (sprint.capacity !== undefined) row.capacity = sprint.capacity;
  if (sprint.capacityUnit !== undefined) row.capacity_unit = sprint.capacityUnit;
  if (sprint.startDate !== undefined) row.start_date = sprint.startDate;
  if (sprint.endDate !== undefined) row.end_date = sprint.endDate;
  if (sprint.notes !== undefined) row.notes = sprint.notes;
  return row;
}

export function releaseToRow(release: Partial<Release> & { id: string }): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (release.name !== undefined) row.name = release.name;
  if (release.targetDate !== undefined) row.target_date = release.targetDate;
  if (release.notes !== undefined) row.notes = release.notes;
  return row;
}

// ─── Board state assembly (pure function) ─────────────────────

export function assembleBoardState(
  board: BoardRow,
  releases: ReleaseRow[],
  sprints: SprintRow[],
  tasks: TaskRow[],
  dependencies: DependencyRow[]
): BoardState {
  const taskModels = tasks.map(toTask);
  const sprintModels = sprints.map(toSprint);
  const depModels = dependencies.map(toDependency);

  return {
    board: toBoard(board),
    releases: releases.map(releaseRow => {
      const release = toRelease(releaseRow);
      const releaseSprints = sprintModels.filter(s => s.releaseId === release.id);
      return {
        ...release,
        sprints: releaseSprints.map(sprint => ({
          ...sprint,
          tasks: taskModels.filter(t => t.sprintId === sprint.id),
        })),
      };
    }),
    dependencies: depModels,
  };
}

// ─── Optimistic update logic (pure function) ──────────────────

/**
 * Move a task from its current sprint to a target sprint,
 * inserting it at a specific index within the target sprint's task list.
 * If insertIndex is omitted or -1, appends to the end.
 */
export function moveTaskBetweenSprints(
  state: BoardState,
  taskId: string,
  targetSprintId: string,
  insertIndex: number = -1
): BoardState {
  const task = findTaskById(state, taskId);
  if (!task) return state;

  // Already in target sprint — just reorder within
  if (task.sprintId === targetSprintId) {
    const sprint = findSprintById(state, targetSprintId);
    if (!sprint) return state;
    const withoutTask = sprint.tasks.filter(t => t.id !== taskId);
    const idx = insertIndex === -1 || insertIndex > withoutTask.length
      ? withoutTask.length
      : insertIndex;
    const reordered = [...withoutTask];
    reordered.splice(idx, 0, { ...task, position: idx });
    // Reindex positions
    const reindexed = reordered.map((t, i) => ({ ...t, position: i }));
    return patchSprint(state, targetSprintId, reindexed);
  }

  // Move between sprints
  const targetSprint = findSprintById(state, targetSprintId);
  if (!targetSprint) return state;

  const movedTask = { ...task, sprintId: targetSprintId };
  const idx = insertIndex === -1 || insertIndex > targetSprint.tasks.length
    ? targetSprint.tasks.length
    : insertIndex;

  // Insert into target at position, remove from source
  const newTargetTasks = [...targetSprint.tasks];
  newTargetTasks.splice(idx, 0, movedTask);
  // Reindex all positions
  const reindexedTarget = newTargetTasks.map((t, i) => ({ ...t, position: i }));

  return {
    ...state,
    releases: state.releases.map(release => ({
      ...release,
      sprints: release.sprints.map(sprint => {
        if (sprint.id === targetSprintId) {
          return { ...sprint, tasks: reindexedTarget };
        }
        // Remove from source sprint and reindex
        const filtered = sprint.tasks.filter(t => t.id !== taskId);
        const reindexed = filtered.map((t, i) => ({ ...t, position: i }));
        return { ...sprint, tasks: reindexed };
      }),
    })),
    dependencies: state.dependencies,
  };
}

export function findTaskById(state: BoardState, taskId: string): Task | undefined {
  for (const release of state.releases) {
    for (const sprint of release.sprints) {
      const task = sprint.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
  }
  return undefined;
}

export function findSprintById(state: BoardState, sprintId: string): SprintWithTasks | undefined {
  for (const release of state.releases) {
    for (const sprint of release.sprints) {
      if (sprint.id === sprintId) return sprint;
    }
  }
  return undefined;
}

export function findSprintIdForTask(state: BoardState, taskId: string): string | undefined {
  for (const release of state.releases) {
    for (const sprint of release.sprints) {
      if (sprint.tasks.some(t => t.id === taskId)) {
        return sprint.id;
      }
    }
  }
  return undefined;
}

/**
 * Resolve a drop target to { sprintId, insertIndex }.
 * - Dropping on a task → insert before that task in its sprint
 * - Dropping on a sprint column → append to end
 */
export function resolveDropTarget(
  state: BoardState,
  overId: string | number
): { sprintId: string; insertIndex: number } | undefined {
  const id = String(overId);
  for (const release of state.releases) {
    for (const sprint of release.sprints) {
      if (sprint.id === id) {
        // Dropped on sprint column → append to end
        return { sprintId: id, insertIndex: sprint.tasks.length };
      }
      const taskIndex = sprint.tasks.findIndex(t => t.id === id);
      if (taskIndex !== -1) {
        // Dropped on a task → insert before it
        return { sprintId: sprint.id, insertIndex: taskIndex };
      }
    }
  }
  return undefined;
}

/** Patch just one sprint's tasks, reindexing positions. */
function patchSprint(state: BoardState, sprintId: string, tasks: Task[]): BoardState {
  return {
    ...state,
    releases: state.releases.map(r => ({
      ...r,
      sprints: r.sprints.map(s =>
        s.id === sprintId ? { ...s, tasks } : s
      ),
    })),
  };
}

// ─── Position calculation (pure function) ─────────────────────

export function nextPosition(items: { position: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map(i => i.position)) + 1;
}