import { randomUUID } from 'crypto';
import type { IDatabase } from './db/adapter';
import { getDb } from './db/sqlite';
import {
  toBoard, toRelease, toSprint, toTask, toDependency,
  assembleBoardState, taskToRow, sprintToRow, releaseToRow, nextPosition,
} from './transform';
import type {
  BoardState, CreateTaskInput, UpdateTaskInput,
  CreateReleaseInput, UpdateReleaseInput,
  CreateSprintInput, UpdateSprintInput,
  Task, Release, Sprint, Dependency,
} from './types';

// ─── Board queries ────────────────────────────────────────

export async function getFullBoardState(boardId: string): Promise<BoardState | null> {
  const db: IDatabase = await getDb();
  const board = await db.getBoard(boardId);
  if (!board) return null;

  const releases = await db.getReleasesByBoardId(boardId);
  const releaseIds = releases.map(r => r.id);
  const sprints = await db.getSprintsByReleaseIds(releaseIds);
  const sprintIds = sprints.map(s => s.id);
  const tasks = await db.getTasksBySprintIds(sprintIds);
  const taskIds = tasks.map(t => t.id);
  const dependencies = await db.getDependenciesByTaskIds(taskIds);

  return assembleBoardState(board, releases, sprints, tasks, dependencies);
}

export async function getOrCreateDefaultBoard(): Promise<BoardState> {
  const db: IDatabase = await getDb();
  const boards = await db.getAllBoards();

  let boardId: string;
  if (boards.length === 0) {
    const board = await db.createBoard(randomUUID(), 'SoulPlan Board');
    boardId = board.id;
  } else {
    boardId = boards[0].id;
  }

  const state = await getFullBoardState(boardId);
  if (!state) throw new Error('Failed to load board state');
  return state;
}

// ─── Release queries ─────────────────────────────────────

export async function createRelease(input: CreateReleaseInput): Promise<Release> {
  const db: IDatabase = await getDb();
  const releases = await db.getReleasesByBoardId(input.boardId);
  const position = nextPosition(releases);
  const row = await db.createRelease(randomUUID(), input.boardId, input.name, position);
  return toRelease(row);
}

export async function updateRelease(input: UpdateReleaseInput): Promise<void> {
  const db: IDatabase = await getDb();
  const fields = releaseToRow(input);
  await db.updateRelease(input.id, fields);
}

export async function deleteRelease(id: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.deleteRelease(id);
}

// ─── Sprint queries ──────────────────────────────────────

export async function createSprint(input: CreateSprintInput): Promise<Sprint> {
  const db: IDatabase = await getDb();
  const sprints = await db.getSprintsByReleaseIds([input.releaseId]);
  const position = nextPosition(sprints);
  const row = await db.createSprint(randomUUID(), input.releaseId, input.name, position);
  return toSprint(row);
}

export async function updateSprint(input: UpdateSprintInput): Promise<void> {
  const db: IDatabase = await getDb();
  const fields = sprintToRow(input);
  await db.updateSprint(input.id, fields);
}

export async function deleteSprint(id: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.deleteSprint(id);
}

// ─── Task queries ─────────────────────────────────────────

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db: IDatabase = await getDb();
  const position = await db.getMaxTaskPosition(input.sprintId);
  const row = await db.createTask(randomUUID(), input.sprintId, input.title, position);
  return toTask(row);
}

export async function updateTask(input: UpdateTaskInput): Promise<void> {
  const db: IDatabase = await getDb();
  const fields = taskToRow(input);
  await db.updateTask(input.id, fields);
}

export async function deleteTask(id: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.deleteTask(id);
}

// ─── Dependency queries ──────────────────────────────────

export async function createDependency(fromTaskId: string, toTaskId: string): Promise<Dependency> {
  const db: IDatabase = await getDb();
  const row = await db.createDependency(randomUUID(), fromTaskId, toTaskId);
  return toDependency(row);
}

export async function deleteDependency(id: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.deleteDependency(id);
}