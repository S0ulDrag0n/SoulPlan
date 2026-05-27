import { randomUUID } from 'crypto';
import type { IDatabase } from './db/adapter';
import { getDb } from './db/sqlite';
import {
  toBoard, toRelease, toSprint, toTask, toDependency,
  assembleBoardState, taskToRow, nextPosition,
} from './transform';
import type {
  BoardState, CreateTaskInput, UpdateTaskInput,
  CreateReleaseInput, CreateSprintInput,
  Task, Release, Sprint, Dependency,
} from './types';

// ─── Board queries ────────────────────────────────────────

export function getFullBoardState(boardId: string): BoardState | null {
  const db: IDatabase = getDb();
  const board = db.getBoard(boardId);
  if (!board) return null;

  const releases = db.getReleasesByBoardId(boardId);
  const releaseIds = releases.map(r => r.id);
  const sprints = db.getSprintsByReleaseIds(releaseIds);
  const sprintIds = sprints.map(s => s.id);
  const tasks = db.getTasksBySprintIds(sprintIds);
  const taskIds = tasks.map(t => t.id);
  const dependencies = db.getDependenciesByTaskIds(taskIds);

  return assembleBoardState(board, releases, sprints, tasks, dependencies);
}

export function getOrCreateDefaultBoard(): BoardState {
  const db: IDatabase = getDb();
  const boards = db.getAllBoards();

  let boardId: string;
  if (boards.length === 0) {
    const board = db.createBoard(randomUUID(), 'SoulPlan Board');
    boardId = board.id;
  } else {
    boardId = boards[0].id;
  }

  const state = getFullBoardState(boardId);
  if (!state) throw new Error('Failed to load board state');
  return state;
}

// ─── Release queries ─────────────────────────────────────

export function createRelease(input: CreateReleaseInput): Release {
  const db: IDatabase = getDb();
  const releases = db.getReleasesByBoardId(input.boardId);
  const position = nextPosition(releases);
  const row = db.createRelease(randomUUID(), input.boardId, input.name, position);
  return toRelease(row);
}

// ─── Sprint queries ──────────────────────────────────────

export function createSprint(input: CreateSprintInput): Sprint {
  const db: IDatabase = getDb();
  const sprints = db.getSprintsByReleaseIds([input.releaseId]);
  const position = nextPosition(sprints);
  const row = db.createSprint(randomUUID(), input.releaseId, input.name, position);
  return toSprint(row);
}

// ─── Task queries ─────────────────────────────────────────

export function createTask(input: CreateTaskInput): Task {
  const db: IDatabase = getDb();
  const position = db.getMaxTaskPosition(input.sprintId);
  const row = db.createTask(randomUUID(), input.sprintId, input.title, position);
  return toTask(row);
}

export function updateTask(input: UpdateTaskInput): void {
  const db: IDatabase = getDb();
  const fields = taskToRow(input);
  db.updateTask(input.id, fields);
}

export function deleteTask(id: string): void {
  const db: IDatabase = getDb();
  db.deleteTask(id);
}

// ─── Dependency queries ──────────────────────────────────

export function createDependency(fromTaskId: string, toTaskId: string): Dependency {
  const db: IDatabase = getDb();
  const row = db.createDependency(randomUUID(), fromTaskId, toTaskId);
  return toDependency(row);
}

export function deleteDependency(id: string): void {
  const db: IDatabase = getDb();
  db.deleteDependency(id);
}