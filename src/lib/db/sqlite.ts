import Database from 'better-sqlite3';
import path from 'path';
import type { IDatabase } from './adapter';
import type {
  BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow,
} from './types';

const DB_PATH = path.join(process.cwd(), 'data', 'soul-plan.db');

let instance: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
  if (!instance) {
    instance = new SQLiteDatabase(DB_PATH);
  }
  return instance;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

/**
 * SQLite database adapter.
 * Uses prepared statements cached for the lifetime of the connection.
 */
export class SQLiteDatabase implements IDatabase {
  private db: Database.Database;

  // Prepared statements (cached on first use)
  private stmts: Map<string, Database.Statement> = new Map();

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private prepare(sql: string): Database.Statement {
    let stmt = this.stmts.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.stmts.set(sql, stmt);
    }
    return stmt;
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS releases (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        target_date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sprints (
        id TEXT PRIMARY KEY,
        release_id TEXT NOT NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        capacity INTEGER DEFAULT 0,
        capacity_unit TEXT DEFAULT 'points',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        sprint_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        estimate INTEGER DEFAULT 0,
        color TEXT DEFAULT '#3b82f6',
        is_critical INTEGER DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS dependencies (
        id TEXT PRIMARY KEY,
        from_task_id TEXT NOT NULL,
        to_task_id TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (from_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (to_task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);
  }

  close() {
    this.db.close();
  }

  // ─── Boards ──────────────────────────────────────────────

  getBoard(id: string): BoardRow | undefined {
    return this.prepare('SELECT * FROM boards WHERE id = ?').get(id) as BoardRow | undefined;
  }

  getAllBoards(): BoardRow[] {
    return this.prepare('SELECT * FROM boards').all() as BoardRow[];
  }

  createBoard(id: string, name: string): BoardRow {
    this.prepare('INSERT INTO boards (id, name) VALUES (?, ?)').run(id, name);
    return this.prepare('SELECT * FROM boards WHERE id = ?').get(id) as BoardRow;
  }

  updateBoardUpdatedAt(id: string): void {
    this.prepare("UPDATE boards SET updated_at = datetime('now') WHERE id = ?").run(id);
  }

  // ─── Releases ─────────────────────────────────────────────

  getReleasesByBoardId(boardId: string): ReleaseRow[] {
    return this.prepare('SELECT * FROM releases WHERE board_id = ? ORDER BY position').all(boardId) as ReleaseRow[];
  }

  createRelease(id: string, boardId: string, name: string, position: number): ReleaseRow {
    this.prepare('INSERT INTO releases (id, board_id, name, position) VALUES (?, ?, ?, ?)').run(id, boardId, name, position);
    return this.prepare('SELECT * FROM releases WHERE id = ?').get(id) as ReleaseRow;
  }

  deleteRelease(id: string): void {
    this.prepare('DELETE FROM releases WHERE id = ?').run(id);
  }

  // ─── Sprints ────────────────────────────────────────────

  getSprintsByReleaseIds(releaseIds: string[]): SprintRow[] {
    if (releaseIds.length === 0) return [];
    const placeholders = releaseIds.map(() => '?').join(',');
    return this.prepare(`SELECT * FROM sprints WHERE release_id IN (${placeholders}) ORDER BY position`)
      .all(...releaseIds) as SprintRow[];
  }

  createSprint(id: string, releaseId: string, name: string, position: number): SprintRow {
    this.prepare('INSERT INTO sprints (id, release_id, name, position) VALUES (?, ?, ?, ?)').run(id, releaseId, name, position);
    return this.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as SprintRow;
  }

  deleteSprint(id: string): void {
    this.prepare('DELETE FROM sprints WHERE id = ?').run(id);
  }

  // ─── Tasks ───────────────────────────────────────────────

  getTasksBySprintIds(sprintIds: string[]): TaskRow[] {
    if (sprintIds.length === 0) return [];
    const placeholders = sprintIds.map(() => '?').join(',');
    return this.prepare(`SELECT * FROM tasks WHERE sprint_id IN (${placeholders}) ORDER BY position`)
      .all(...sprintIds) as TaskRow[];
  }

  createTask(id: string, sprintId: string, title: string, position: number): TaskRow {
    this.prepare('INSERT INTO tasks (id, sprint_id, title, position) VALUES (?, ?, ?, ?)').run(id, sprintId, title, position);
    return this.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow;
  }

  updateTask(id: string, fields: Record<string, unknown>): void {
    const allowedKeys = ['title', 'description', 'estimate', 'color', 'is_critical', 'sprint_id', 'position'];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (allowedKeys.includes(key)) {
        sets.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (sets.length === 0) return;
    values.push(id);
    this.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteTask(id: string): void {
    this.prepare('DELETE FROM dependencies WHERE from_task_id = ? OR to_task_id = ?').run(id, id);
    this.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }

  getMaxTaskPosition(sprintId: string): number {
    const row = this.prepare('SELECT COALESCE(MAX(position), -1) + 1 as pos FROM tasks WHERE sprint_id = ?').get(sprintId) as { pos: number };
    return row.pos;
  }

  // ─── Dependencies ──────────────────────────────────────

  getDependenciesByTaskIds(taskIds: string[]): DependencyRow[] {
    if (taskIds.length === 0) return [];
    const placeholders = taskIds.map(() => '?').join(',');
    return this.prepare(
      `SELECT * FROM dependencies WHERE from_task_id IN (${placeholders}) OR to_task_id IN (${placeholders})`
    ).all(...taskIds, ...taskIds) as DependencyRow[];
  }

  createDependency(id: string, fromTaskId: string, toTaskId: string): DependencyRow {
    this.prepare('INSERT INTO dependencies (id, from_task_id, to_task_id) VALUES (?, ?, ?)').run(id, fromTaskId, toTaskId);
    return this.prepare('SELECT * FROM dependencies WHERE id = ?').get(id) as DependencyRow;
  }

  deleteDependency(id: string): void {
    this.prepare('DELETE FROM dependencies WHERE id = ?').run(id);
  }

  deleteDependenciesByTaskId(taskId: string): void {
    this.prepare('DELETE FROM dependencies WHERE from_task_id = ? OR to_task_id = ?').run(taskId, taskId);
  }
}