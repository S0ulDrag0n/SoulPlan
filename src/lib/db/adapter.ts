import type {
  BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow,
} from './types';

/**
 * Database adapter interface.
 * Swappable implementation — sql.js for universal compat, Postgres for production.
 * All methods return raw DB rows (snake_case). Transform to camelCase in the service layer.
 *
 * Since sql.js (WASM) requires async initialization, all methods are async.
 */
export interface IDatabase {
  // ─── Lifecycle ─────────────────────────────────────────
  close(): void;

  // ─── Boards ──────────────────────────────────────────────
  getBoard(id: string): Promise<BoardRow | undefined>;
  getAllBoards(): Promise<BoardRow[]>;
  createBoard(id: string, name: string): Promise<BoardRow>;
  updateBoardUpdatedAt(id: string): Promise<void>;

  // ─── Releases ─────────────────────────────────────────────
  getReleasesByBoardId(boardId: string): Promise<ReleaseRow[]>;
  createRelease(id: string, boardId: string, name: string, position: number): Promise<ReleaseRow>;
  deleteRelease(id: string): Promise<void>;

  // ─── Sprints ────────────────────────────────────────────
  getSprintsByReleaseIds(releaseIds: string[]): Promise<SprintRow[]>;
  createSprint(id: string, releaseId: string, name: string, position: number): Promise<SprintRow>;
  deleteSprint(id: string): Promise<void>;

  // ─── Tasks ───────────────────────────────────────────────
  getTasksBySprintIds(sprintIds: string[]): Promise<TaskRow[]>;
  createTask(id: string, sprintId: string, title: string, position: number): Promise<TaskRow>;
  updateTask(id: string, fields: Record<string, unknown>): Promise<void>;
  deleteTask(id: string): Promise<void>;
  getMaxTaskPosition(sprintId: string): Promise<number>;

  // ─── Dependencies ──────────────────────────────────────
  getDependenciesByTaskIds(taskIds: string[]): Promise<DependencyRow[]>;
  createDependency(id: string, fromTaskId: string, toTaskId: string): Promise<DependencyRow>;
  deleteDependency(id: string): Promise<void>;
  deleteDependenciesByTaskId(taskId: string): Promise<void>;
}