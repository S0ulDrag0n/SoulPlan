import type { BoardState, TaskFilter } from './types';

/**
 * Apply a task filter to a board state and return the set of matching task IDs.
 * Returns null when no filter is active — caller should render normally.
 *
 * This is a pure function with no DB imports so it's safe to import from client components.
 */
export function applyTaskFilter(
  state: BoardState | null,
  filter: TaskFilter
): Set<string> | null {
  if (!state) return null;
  const hasStatus = !!filter.status;
  const hasSprint = !!filter.sprintId;
  const hasJira = filter.hasJira === true;
  if (!hasStatus && !hasSprint && !hasJira) return null;

  const matching = new Set<string>();
  for (const release of state.releases) {
    for (const sprint of release.sprints) {
      for (const task of sprint.tasks) {
        if (hasSprint && task.sprintId !== filter.sprintId) continue;
        if (hasStatus && task.status !== filter.status) continue;
        matching.add(task.id);
      }
    }
  }
  return matching;
}