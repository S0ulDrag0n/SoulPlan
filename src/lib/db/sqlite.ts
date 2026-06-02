import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import type { IDatabase } from './adapter';
import type {
  BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'soul-plan.db');

let instance: SqlJsDatabase | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;

export async function getDb(): Promise<IDatabase> {
  if (instance) return new SqlJsDataAdapter(instance);
  if (!initPromise) {
    initPromise = initialize();
  }
  instance = await initPromise;
  return new SqlJsDataAdapter(instance);
}

async function initialize(): Promise<SqlJsDatabase> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  let db: SqlJsDatabase;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  migrate(db);
  migrateV2(db);
  migrateV3(db);
  return db;
}

function migrate(db: SqlJsDatabase): void {
  db.run(`
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
      start_date TEXT,
      end_date TEXT,
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

function migrateV2(db: SqlJsDatabase): void {
  // Add start_date and end_date columns to sprints if they don't exist
  const cols = getAll(db, "PRAGMA table_info(sprints)");
  const colNames = cols.map((r) => r.name as string);
  if (!colNames.includes('start_date')) {
    db.run('ALTER TABLE sprints ADD COLUMN start_date TEXT');
  }
  if (!colNames.includes('end_date')) {
    db.run('ALTER TABLE sprints ADD COLUMN end_date TEXT');
  }
}

function migrateV3(db: SqlJsDatabase): void {
  // Add UNIQUE constraint on dependencies (from_task_id, to_task_id)
  // SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we create an index
  try {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_dep_unique ON dependencies(from_task_id, to_task_id)');
  } catch {
    // Index may already exist or data has duplicates — skip gracefully
  }
}

function saveToDisk(db: SqlJsDatabase): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

type Row = Record<string, SqlValue>;

function getOne(db: SqlJsDatabase, sql: string, params: SqlValue[] = []): Row | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  try {
    if (stmt.step()) {
      return stmt.getAsObject();
    }
    return undefined;
  } finally {
    stmt.free();
  }
}

function getAll(db: SqlJsDatabase, sql: string, params: SqlValue[] = []): Row[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: Row[] = [];
  try {
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    return results;
  } finally {
    stmt.free();
  }
}

class SqlJsDataAdapter implements IDatabase {
  constructor(private db: SqlJsDatabase) {}

  close(): void {
    if (instance) {
      saveToDisk(instance);
      instance.close();
      instance = null;
      initPromise = null;
    }
  }

  // ─── Boards ──────────────────────────────────────────────

  async getBoard(id: string): Promise<BoardRow | undefined> {
    const row = getOne(this.db, 'SELECT * FROM boards WHERE id = ?', [id]);
    return row as unknown as BoardRow | undefined;
  }

  async getAllBoards(): Promise<BoardRow[]> {
    return getAll(this.db, 'SELECT * FROM boards') as unknown as BoardRow[];
  }

  async createBoard(id: string, name: string): Promise<BoardRow> {
    this.db.run('INSERT INTO boards (id, name) VALUES (?, ?)', [id, name]);
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM boards WHERE id = ?', [id]);
    return row as unknown as BoardRow;
  }

  async updateBoardUpdatedAt(id: string): Promise<void> {
    this.db.run("UPDATE boards SET updated_at = datetime('now') WHERE id = ?", [id]);
    saveToDisk(this.db);
  }

  // ─── Releases ─────────────────────────────────────────────

  async getReleasesByBoardId(boardId: string): Promise<ReleaseRow[]> {
    return getAll(this.db, 'SELECT * FROM releases WHERE board_id = ? ORDER BY position', [boardId]) as unknown as ReleaseRow[];
  }

  async createRelease(id: string, boardId: string, name: string, position: number): Promise<ReleaseRow> {
    this.db.run('INSERT INTO releases (id, board_id, name, position) VALUES (?, ?, ?, ?)', [id, boardId, name, position]);
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM releases WHERE id = ?', [id]);
    return row as unknown as ReleaseRow;
  }

  async deleteRelease(id: string): Promise<void> {
    this.db.run('DELETE FROM releases WHERE id = ?', [id]);
    saveToDisk(this.db);
  }

  async updateRelease(id: string, fields: Record<string, unknown>): Promise<void> {
    const allowedKeys = ['name', 'target_date', 'notes'] as const;
    const sets: string[] = [];
    const values: SqlValue[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if ((allowedKeys as readonly string[]).includes(key)) {
        sets.push(`${key} = ?`);
        values.push(value as SqlValue);
      }
    }
    if (sets.length === 0) return;
    values.push(id);
    this.db.run(`UPDATE releases SET ${sets.join(', ')} WHERE id = ?`, values);
    saveToDisk(this.db);
  }

  // ─── Sprints ────────────────────────────────────────────

  async getSprintsByReleaseIds(releaseIds: string[]): Promise<SprintRow[]> {
    if (releaseIds.length === 0) return [];
    const placeholders = releaseIds.map(() => '?').join(',');
    return getAll(
      this.db,
      `SELECT * FROM sprints WHERE release_id IN (${placeholders}) ORDER BY position`,
      releaseIds,
    ) as unknown as SprintRow[];
  }

  async createSprint(id: string, releaseId: string, name: string, position: number): Promise<SprintRow> {
    this.db.run('INSERT INTO sprints (id, release_id, name, position) VALUES (?, ?, ?, ?)', [id, releaseId, name, position]);
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM sprints WHERE id = ?', [id]);
    return row as unknown as SprintRow;
  }

  async deleteSprint(id: string): Promise<void> {
    this.db.run('DELETE FROM sprints WHERE id = ?', [id]);
    saveToDisk(this.db);
  }

  async updateSprint(id: string, fields: Record<string, unknown>): Promise<void> {
    const allowedKeys = ['name', 'capacity', 'capacity_unit', 'start_date', 'end_date', 'notes'] as const;
    const sets: string[] = [];
    const values: SqlValue[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if ((allowedKeys as readonly string[]).includes(key)) {
        sets.push(`${key} = ?`);
        values.push(value as SqlValue);
      }
    }
    if (sets.length === 0) return;
    values.push(id);
    this.db.run(`UPDATE sprints SET ${sets.join(', ')} WHERE id = ?`, values);
    saveToDisk(this.db);
  }

  // ─── Tasks ───────────────────────────────────────────────

  async getTasksBySprintIds(sprintIds: string[]): Promise<TaskRow[]> {
    if (sprintIds.length === 0) return [];
    const placeholders = sprintIds.map(() => '?').join(',');
    return getAll(
      this.db,
      `SELECT * FROM tasks WHERE sprint_id IN (${placeholders}) ORDER BY position`,
      sprintIds,
    ) as unknown as TaskRow[];
  }

  async createTask(id: string, sprintId: string, title: string, position: number): Promise<TaskRow> {
    this.db.run('INSERT INTO tasks (id, sprint_id, title, position) VALUES (?, ?, ?, ?)', [id, sprintId, title, position]);
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM tasks WHERE id = ?', [id]);
    return row as unknown as TaskRow;
  }

  async updateTask(id: string, fields: Record<string, unknown>): Promise<void> {
    const allowedKeys = ['title', 'description', 'estimate', 'color', 'is_critical', 'sprint_id', 'position'] as const;
    const sets: string[] = [];
    const values: SqlValue[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if ((allowedKeys as readonly string[]).includes(key)) {
        sets.push(`${key} = ?`);
        values.push(value as SqlValue);
      }
    }
    if (sets.length === 0) return;
    values.push(id);
    this.db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, values);
    saveToDisk(this.db);
  }

  async deleteTask(id: string): Promise<void> {
    this.db.run('DELETE FROM dependencies WHERE from_task_id = ? OR to_task_id = ?', [id, id]);
    this.db.run('DELETE FROM tasks WHERE id = ?', [id]);
    saveToDisk(this.db);
  }

  async getMaxTaskPosition(sprintId: string): Promise<number> {
    const row = getOne(this.db, 'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM tasks WHERE sprint_id = ?', [sprintId]);
    return (row?.pos as number) ?? 0;
  }

  // ─── Dependencies ──────────────────────────────────────

  async getDependenciesByTaskIds(taskIds: string[]): Promise<DependencyRow[]> {
    if (taskIds.length === 0) return [];
    const placeholders = taskIds.map(() => '?').join(',');
    return getAll(
      this.db,
      `SELECT * FROM dependencies WHERE from_task_id IN (${placeholders}) OR to_task_id IN (${placeholders})`,
      [...taskIds, ...taskIds],
    ) as unknown as DependencyRow[];
  }

  async createDependency(id: string, fromTaskId: string, toTaskId: string): Promise<DependencyRow> {
    this.db.run('INSERT INTO dependencies (id, from_task_id, to_task_id) VALUES (?, ?, ?)', [id, fromTaskId, toTaskId]);
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM dependencies WHERE id = ?', [id]);
    return row as unknown as DependencyRow;
  }

  async deleteDependency(id: string): Promise<void> {
    this.db.run('DELETE FROM dependencies WHERE id = ?', [id]);
    saveToDisk(this.db);
  }

  async deleteDependenciesByTaskId(taskId: string): Promise<void> {
    this.db.run('DELETE FROM dependencies WHERE from_task_id = ? OR to_task_id = ?', [taskId, taskId]);
    saveToDisk(this.db);
  }

  async findDependency(fromTaskId: string, toTaskId: string): Promise<DependencyRow | undefined> {
    const row = getOne(this.db, 'SELECT * FROM dependencies WHERE from_task_id = ? AND to_task_id = ?', [fromTaskId, toTaskId]);
    return row as unknown as DependencyRow | undefined;
  }
}