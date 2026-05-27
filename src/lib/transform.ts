import type {
  BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow,
} from './db/types';
import type {
  Board, Release, Sprint, Task, Dependency, BoardState,
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

export function moveTaskBetweenSprints(
  state: BoardState,
  taskId: string,
  targetSprintId: string
): BoardState {
  return {
    ...state,
    releases: state.releases.map(release => ({
      ...release,
      sprints: release.sprints.map(sprint => {
        // Add task to target sprint
        if (sprint.id === targetSprintId) {
          const task = findTaskById(state, taskId);
          if (!task) return sprint;
          // Avoid duplicate if source === target
          if (task.sprintId === targetSprintId) return sprint;
          return { ...sprint, tasks: [...sprint.tasks, { ...task, sprintId: targetSprintId }] };
        }
        // Remove task from source sprint
        return { ...sprint, tasks: sprint.tasks.filter(t => t.id !== taskId) };
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

export function resolveDropTarget(
  state: BoardState,
  overId: string | number
): string | undefined {
  const id = String(overId);
  // Check if dropped on a sprint directly
  for (const release of state.releases) {
    for (const sprint of release.sprints) {
      if (sprint.id === id) return id;
      if (sprint.tasks.some(t => t.id === id)) return sprint.id;
    }
  }
  return undefined;
}

// ─── Position calculation (pure function) ─────────────────────

export function nextPosition(items: { position: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map(i => i.position)) + 1;
}