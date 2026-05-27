import type {
  BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow,
} from './types';

/**
 * Database adapter interface.
 * Swappable implementation — SQLite for local/dev, Postgres for production.
 * All methods return raw DB rows (snake_case). Transform to camelCase in the service layer.
 */
export interface IDatabase {
  // ─── Boards ──────────────────────────────────────────────
  getBoard(id: string): BoardRow | undefined;
  getAllBoards(): BoardRow[];
  createBoard(id: string, name: string): BoardRow;
  updateBoardUpdatedAt(id: string): void;

  // ─── Releases ─────────────────────────────────────────────
  getReleasesByBoardId(boardId: string): ReleaseRow[];
  createRelease(id: string, boardId: string, name: string, position: number): ReleaseRow;
  deleteRelease(id: string): void;

  // ─── Sprints ────────────────────────────────────────────
  getSprintsByReleaseIds(releaseIds: string[]): SprintRow[];
  createSprint(id: string, releaseId: string, name: string, position: number): SprintRow;
  deleteSprint(id: string): void;

  // ─── Tasks ───────────────────────────────────────────────
  getTasksBySprintIds(sprintIds: string[]): TaskRow[];
  createTask(id: string, sprintId: string, title: string, position: number): TaskRow;
  updateTask(id: string, fields: Record<string, unknown>): void;
  deleteTask(id: string): void;
  getMaxTaskPosition(sprintId: string): number;

  // ─── Dependencies ──────────────────────────────────────
  getDependenciesByTaskIds(taskIds: string[]): DependencyRow[];
  createDependency(id: string, fromTaskId: string, toTaskId: string): DependencyRow;
  deleteDependency(id: string): void;
  deleteDependenciesByTaskId(taskId: string): void;
}