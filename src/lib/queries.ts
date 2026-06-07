import { randomUUID } from 'crypto';
import type { IDatabase } from './db/adapter';
import { getDb } from './db/sqlite';
import {
  toBoard, toRelease, toSprint, toTask, toDependency,
  toStickyNote, toNoteConnection,
  assembleBoardState, taskToRow, sprintToRow, releaseToRow,
  stickyNoteToRow, nextPosition,
} from './transform';
import type {
  BoardState, CreateTaskInput, UpdateTaskInput,
  CreateReleaseInput, UpdateReleaseInput,
  CreateSprintInput, UpdateSprintInput,
  CreateStickyNoteInput, UpdateStickyNoteInput,
  CreateNoteConnectionInput,
  Task, Release, Sprint, Dependency, StickyNote, NoteConnection,
  NoteConnectionTargetType,
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
  const stickyNotes = await db.getStickyNotesByBoardId(boardId);
  const noteConnections = await db.getNoteConnectionsByBoardId(boardId);

  return assembleBoardState(board, releases, sprints, tasks, dependencies, stickyNotes, noteConnections);
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

export async function findDependency(fromTaskId: string, toTaskId: string): Promise<Dependency | null> {
  const db: IDatabase = await getDb();
  const row = await db.findDependency(fromTaskId, toTaskId);
  return row ? toDependency(row) : null;
}

// ─── Sticky note queries ──────────────────────────────────

/** Find a free (x, y) slot near the given coords so new notes don't stack. */
async function findFreeNotePosition(
  boardId: string,
  desiredX: number,
  desiredY: number
): Promise<{ x: number; y: number }> {
  const db: IDatabase = await getDb();
  const existing = await db.getStickyNotesByBoardId(boardId);
  const minDistance = 220; // roughly a note's width + a little padding
  let { x, y } = { x: desiredX, y: desiredY };
  // If too close to an existing note, offset to the right of it
  for (const n of existing) {
    const dx = Math.abs(n.x - x);
    const dy = Math.abs(n.y - y);
    if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
      x = n.x + 240;
      y = n.y;
    }
  }
  return { x, y };
}

export async function createStickyNote(input: CreateStickyNoteInput): Promise<StickyNote> {
  const db: IDatabase = await getDb();
  const { x, y } = await findFreeNotePosition(input.boardId, input.x, input.y);
  const existing = await db.getStickyNotesByBoardId(input.boardId);
  const z = existing.length === 0 ? 0 : Math.max(...existing.map(n => n.z)) + 1;
  const row = await db.createStickyNote(
    randomUUID(),
    input.boardId,
    input.text ?? '',
    x,
    y,
    input.color ?? 'yellow',
    z
  );
  return toStickyNote(row);
}

export async function updateStickyNote(input: UpdateStickyNoteInput): Promise<void> {
  const db: IDatabase = await getDb();
  const fields = stickyNoteToRow(input);
  await db.updateStickyNote(input.id, fields);
}

export async function deleteStickyNote(id: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.deleteStickyNote(id);
}

// ─── Note connection queries ──────────────────────────────

export async function createNoteConnection(input: CreateNoteConnectionInput): Promise<NoteConnection> {
  const db: IDatabase = await getDb();
  const existing = await db.findNoteConnection(input.noteId, input.toType, input.toId);
  if (existing) {
    // Idempotent: return the existing connection rather than 409. The
    // unique index prevents duplicates at the DB level; the client just
    // gets the same row back.
    return toNoteConnection(existing);
  }
  const row = await db.createNoteConnection(
    randomUUID(),
    input.noteId,
    input.toType,
    input.toId
  );
  return toNoteConnection(row);
}

export async function deleteNoteConnection(id: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.deleteNoteConnection(id);
}

export async function findNoteConnection(
  noteId: string,
  toType: NoteConnectionTargetType,
  toId: string
): Promise<NoteConnection | null> {
  const db: IDatabase = await getDb();
  const row = await db.findNoteConnection(noteId, toType, toId);
  return row ? toNoteConnection(row) : null;
}