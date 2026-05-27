import { getDb } from './db';
import { randomUUID } from 'crypto';
import type { Board, Release, Sprint, Task, Dependency, BoardState } from './types';

// ─── Boards ────────────────────────────────────────────────

export function getFullBoardState(boardId: string): BoardState | null {
  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId) as Board | undefined;
  if (!board) return null;

  const releases = db.prepare('SELECT * FROM releases WHERE board_id = ? ORDER BY position')
    .all(boardId) as Release[];

  const sprints = releases.length > 0
    ? db.prepare('SELECT * FROM sprints WHERE release_id IN (' + releases.map(() => '?').join(',') + ') ORDER BY position')
        .all(...releases.map(r => r.id)) as Sprint[]
    : [];

  const sprintIds = sprints.map(s => s.id);

  const tasks = sprintIds.length > 0
    ? db.prepare('SELECT * FROM tasks WHERE sprint_id IN (' + sprintIds.map(() => '?').join(',') + ') ORDER BY position')
        .all(...sprintIds) as Task[]
    : [];

  const taskIds = tasks.map(t => t.id);
  const dependencies = taskIds.length > 0
    ? db.prepare('SELECT * FROM dependencies WHERE from_task_id IN (' + taskIds.map(() => '?').join(',') + ') OR to_task_id IN (' + taskIds.map(() => '?').join(',') + ')')
        .all(...taskIds, ...taskIds) as Dependency[]
    : [];

  return {
    board,
    releases: releases.map(r => ({
      ...r,
      sprints: sprints
        .filter(s => s.release_id === r.id)
        .map(s => ({
          ...s,
          tasks: tasks.filter(t => t.sprint_id === s.id),
        })),
    })),
    dependencies,
  };
}

export function createBoard(name: string): Board {
  const db = getDb();
  const id = randomUUID();
  db.prepare('INSERT INTO boards (id, name) VALUES (?, ?)').run(id, name);
  return db.prepare('SELECT * FROM boards WHERE id = ?').get(id) as Board;
}

// ─── Releases ───────────────────────────────────────────────

export function createRelease(boardId: string, name: string, position: number): Release {
  const db = getDb();
  const id = randomUUID();
  db.prepare('INSERT INTO releases (id, board_id, name, position) VALUES (?, ?, ?, ?)').run(id, boardId, name, position);
  return db.prepare('SELECT * FROM releases WHERE id = ?').get(id) as Release;
}

// ─── Sprints ────────────────────────────────────────────────

export function createSprint(releaseId: string, name: string, position: number): Sprint {
  const db = getDb();
  const id = randomUUID();
  db.prepare('INSERT INTO sprints (id, release_id, name, position) VALUES (?, ?, ?, ?)').run(id, releaseId, name, position);
  return db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as Sprint;
}

// ─── Tasks ──────────────────────────────────────────────────

export function createTask(sprintId: string, title: string, position: number): Task {
  const db = getDb();
  const id = randomUUID();
  db.prepare('INSERT INTO tasks (id, sprint_id, title, position) VALUES (?, ?, ?, ?)').run(id, sprintId, title, position);
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
}

export function updateTask(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const allowedKeys = ['title', 'description', 'estimate', 'color', 'is_critical', 'sprint_id', 'position'];
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (allowedKeys.includes(key)) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteTask(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM dependencies WHERE from_task_id = ? OR to_task_id = ?').run(id, id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

// ─── Dependencies ──────────────────────────────────────────

export function createDependency(fromTaskId: string, toTaskId: string): Dependency {
  const db = getDb();
  const id = randomUUID();
  db.prepare('INSERT INTO dependencies (id, from_task_id, to_task_id) VALUES (?, ?, ?)').run(id, fromTaskId, toTaskId);
  return db.prepare('SELECT * FROM dependencies WHERE id = ?').get(id) as Dependency;
}

export function deleteDependency(id: string) {
  getDb().prepare('DELETE FROM dependencies WHERE id = ?').run(id);
}