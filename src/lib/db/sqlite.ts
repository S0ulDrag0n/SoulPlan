import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import type { IDatabase } from './adapter';
import type {
  BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow,
  StickyNoteRow, NoteConnectionRow, NoteConnectionTargetType,
  ProjectRow, UserRow, GuestRow, ProjectMemberRow, SessionRow,
  MemberType, MemberRole,
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
  migrateV4(db);
  migrateV5(db);
  migrateV6(db);
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

function migrateV4(db: SqlJsDatabase): void {
  // Sticky notes — free-floating text notes anchored to a board, with
  // pan-space (x, y) coordinates. Cascade-delete with their board.
  db.run(`
    CREATE TABLE IF NOT EXISTS sticky_notes (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT 'yellow',
      z INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );
  `);

  // Polymorphic connections: a sticky note → task | sprint | release.
  // No FK on to_id because to_id is polymorphic; cleanup is enforced in
  // the SqlJsDataAdapter (see deleteTask / deleteSprint / deleteRelease
  // which now also clean up note_connections referencing them).
  // Cascade-delete with their parent note.
  db.run(`
    CREATE TABLE IF NOT EXISTS note_connections (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      to_type TEXT NOT NULL CHECK (to_type IN ('task', 'sprint', 'release')),
      to_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (note_id) REFERENCES sticky_notes(id) ON DELETE CASCADE
    );
  `);

  // Idempotency: no two identical (note, target) connections
  try {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_note_conn_unique ON note_connections(note_id, to_type, to_id)');
  } catch {
    // Existing data may have duplicates — skip gracefully
  }
}

function migrateV5(db: SqlJsDatabase): void {
  // Projects — new top-level entity containing boards.
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add project_id column to boards (nullable for migration period).
  const boardCols = getAll(db, "PRAGMA table_info(boards)");
  const boardColNames = boardCols.map((r) => r.name as string);
  if (!boardColNames.includes('project_id')) {
    db.run('ALTER TABLE boards ADD COLUMN project_id TEXT');
  }
}

function migrateV6(db: SqlJsDatabase): void {
  // Users with passwords (scrypt hash stored as hex string).
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Guests — name only, no password.
  db.run(`
    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Project membership — links users or guests to projects with a role.
  db.run(`
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      member_type TEXT NOT NULL CHECK (member_type IN ('user', 'guest')),
      member_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Idempotency: one membership per (project, member) pair.
  try {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_project_member_unique ON project_members(project_id, member_id)');
  } catch {
    // Existing data may have duplicates — skip gracefully
  }

  // Sessions — simple token-based auth stored in the DB.
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      member_type TEXT NOT NULL CHECK (member_type IN ('user', 'guest')),
      member_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
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

  async getBoardsByProjectId(projectId: string): Promise<BoardRow[]> {
    return getAll(
      this.db,
      'SELECT * FROM boards WHERE project_id = ? ORDER BY created_at',
      [projectId]
    ) as unknown as BoardRow[];
  }

  async createBoard(id: string, name: string, projectId: string | null = null): Promise<BoardRow> {
    this.db.run('INSERT INTO boards (id, name, project_id) VALUES (?, ?, ?)', [id, name, projectId]);
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM boards WHERE id = ?', [id]);
    return row as unknown as BoardRow;
  }

  async updateBoardUpdatedAt(id: string): Promise<void> {
    this.db.run("UPDATE boards SET updated_at = datetime('now') WHERE id = ?", [id]);
    saveToDisk(this.db);
  }

  // ─── Projects ─────────────────────────────────────────────

  async getProject(id: string): Promise<ProjectRow | undefined> {
    const row = getOne(this.db, 'SELECT * FROM projects WHERE id = ?', [id]);
    return row as unknown as ProjectRow | undefined;
  }

  async getAllProjects(): Promise<ProjectRow[]> {
    return getAll(this.db, 'SELECT * FROM projects ORDER BY created_at') as unknown as ProjectRow[];
  }

  async createProject(id: string, name: string, ownerId: string | null = null): Promise<ProjectRow> {
    this.db.run('INSERT INTO projects (id, name, owner_id) VALUES (?, ?, ?)', [id, name, ownerId]);
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM projects WHERE id = ?', [id]);
    return row as unknown as ProjectRow;
  }

  async updateProject(id: string, fields: Record<string, unknown>): Promise<void> {
    const allowedKeys = ['name', 'owner_id'] as const;
    const sets: string[] = [];
    const values: SqlValue[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if ((allowedKeys as readonly string[]).includes(key)) {
        sets.push(`${key} = ?`);
        values.push(value as SqlValue);
      }
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    values.push(id);
    this.db.run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, values);
    saveToDisk(this.db);
  }

  async deleteProject(id: string): Promise<void> {
    // Clean up boards' project_id references before deleting (boards are not FK-cascade).
    this.db.run('UPDATE boards SET project_id = NULL WHERE project_id = ?', [id]);
    this.db.run('DELETE FROM projects WHERE id = ?', [id]);
    saveToDisk(this.db);
  }

  // ─── Users ────────────────────────────────────────────────

  async getUser(id: string): Promise<UserRow | undefined> {
    const row = getOne(this.db, 'SELECT * FROM users WHERE id = ?', [id]);
    return row as unknown as UserRow | undefined;
  }

  async getUserByUsername(username: string): Promise<UserRow | undefined> {
    const row = getOne(this.db, 'SELECT * FROM users WHERE username = ?', [username]);
    return row as unknown as UserRow | undefined;
  }

  async createUser(id: string, username: string, passwordHash: string, displayName: string | null = null): Promise<UserRow> {
    this.db.run('INSERT INTO users (id, username, password_hash, display_name) VALUES (?, ?, ?, ?)', [id, username, passwordHash, displayName]);
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM users WHERE id = ?', [id]);
    return row as unknown as UserRow;
  }

  // ─── Guests ───────────────────────────────────────────────

  async getGuest(id: string): Promise<GuestRow | undefined> {
    const row = getOne(this.db, 'SELECT * FROM guests WHERE id = ?', [id]);
    return row as unknown as GuestRow | undefined;
  }

  async createGuest(id: string, name: string): Promise<GuestRow> {
    this.db.run('INSERT INTO guests (id, name) VALUES (?, ?)', [id, name]);
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM guests WHERE id = ?', [id]);
    return row as unknown as GuestRow;
  }

  // ─── Project Members ──────────────────────────────────────

  async getProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
    return getAll(
      this.db,
      'SELECT * FROM project_members WHERE project_id = ? ORDER BY created_at',
      [projectId]
    ) as unknown as ProjectMemberRow[];
  }

  async getProjectsByMemberId(memberId: string): Promise<ProjectRow[]> {
    return getAll(
      this.db,
      `SELECT p.* FROM projects p
       INNER JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.member_id = ?
       ORDER BY p.created_at`,
      [memberId]
    ) as unknown as ProjectRow[];
  }

  async addProjectMember(id: string, projectId: string, memberType: MemberType, memberId: string, role: MemberRole): Promise<ProjectMemberRow> {
    this.db.run(
      'INSERT INTO project_members (id, project_id, member_type, member_id, role) VALUES (?, ?, ?, ?, ?)',
      [id, projectId, memberType, memberId, role]
    );
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM project_members WHERE id = ?', [id]);
    return row as unknown as ProjectMemberRow;
  }

  async removeProjectMember(id: string): Promise<void> {
    this.db.run('DELETE FROM project_members WHERE id = ?', [id]);
    saveToDisk(this.db);
  }

  async findProjectMember(projectId: string, memberId: string): Promise<ProjectMemberRow | undefined> {
    const row = getOne(
      this.db,
      'SELECT * FROM project_members WHERE project_id = ? AND member_id = ?',
      [projectId, memberId]
    );
    return row as unknown as ProjectMemberRow | undefined;
  }

  // ─── Sessions ─────────────────────────────────────────────

  async createSession(token: string, memberType: MemberType, memberId: string, displayName: string): Promise<SessionRow> {
    this.db.run(
      'INSERT INTO sessions (token, member_type, member_id, display_name) VALUES (?, ?, ?, ?)',
      [token, memberType, memberId, displayName]
    );
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM sessions WHERE token = ?', [token]);
    return row as unknown as SessionRow;
  }

  async getSession(token: string): Promise<SessionRow | undefined> {
    const row = getOne(this.db, 'SELECT * FROM sessions WHERE token = ?', [token]);
    return row as unknown as SessionRow | undefined;
  }

  async deleteSession(token: string): Promise<void> {
    this.db.run('DELETE FROM sessions WHERE token = ?', [token]);
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
    // Note connections are polymorphic and FK-less, so we must manually
    // cascade-clean them for any sprints/tasks that live under this release.
    // Order: tasks (most specific) → sprints → release.
    const sprintIds = getAll(
      this.db,
      'SELECT id FROM sprints WHERE release_id = ?',
      [id]
    ).map(r => r.id as string);
    if (sprintIds.length > 0) {
      const taskIds = getAll(
        this.db,
        `SELECT id FROM tasks WHERE sprint_id IN (${sprintIds.map(() => '?').join(',')})`,
        sprintIds
      ).map(r => r.id as string);
      for (const taskId of taskIds) {
        this.db.run(
          'DELETE FROM note_connections WHERE to_type = ? AND to_id = ?',
          ['task', taskId]
        );
      }
      for (const sprintId of sprintIds) {
        this.db.run(
          'DELETE FROM note_connections WHERE to_type = ? AND to_id = ?',
          ['sprint', sprintId]
        );
      }
    }
    this.db.run('DELETE FROM note_connections WHERE to_type = ? AND to_id = ?', ['release', id]);
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
    // Tasks under this sprint get cascaded via FK, but note_connections
    // targeting those tasks don't (polymorphic, no FK). Clean them up first.
    const taskIds = getAll(
      this.db,
      'SELECT id FROM tasks WHERE sprint_id = ?',
      [id]
    ).map(r => r.id as string);
    for (const taskId of taskIds) {
      this.db.run(
        'DELETE FROM note_connections WHERE to_type = ? AND to_id = ?',
        ['task', taskId]
      );
    }
    this.db.run('DELETE FROM note_connections WHERE to_type = ? AND to_id = ?', ['sprint', id]);
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
    this.db.run('DELETE FROM note_connections WHERE to_type = ? AND to_id = ?', ['task', id]);
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

  // ─── Sticky notes ────────────────────────────────────────

  async getStickyNotesByBoardId(boardId: string): Promise<StickyNoteRow[]> {
    return getAll(
      this.db,
      'SELECT * FROM sticky_notes WHERE board_id = ? ORDER BY z, created_at',
      [boardId]
    ) as unknown as StickyNoteRow[];
  }

  async createStickyNote(
    id: string,
    boardId: string,
    text: string,
    x: number,
    y: number,
    color: string,
    z: number
  ): Promise<StickyNoteRow> {
    this.db.run(
      'INSERT INTO sticky_notes (id, board_id, text, x, y, color, z) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, boardId, text, x, y, color, z]
    );
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM sticky_notes WHERE id = ?', [id]);
    return row as unknown as StickyNoteRow;
  }

  async updateStickyNote(id: string, fields: Record<string, unknown>): Promise<void> {
    const allowedKeys = ['text', 'x', 'y', 'color', 'z'] as const;
    const sets: string[] = [];
    const values: SqlValue[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if ((allowedKeys as readonly string[]).includes(key)) {
        sets.push(`${key} = ?`);
        values.push(value as SqlValue);
      }
    }
    if (sets.length === 0) return;
    // Bump updated_at on every edit so the client can detect unsaved changes
    // if it ever needs to (cheap, useful for future "modified" indicators).
    sets.push("updated_at = datetime('now')");
    values.push(id);
    this.db.run(`UPDATE sticky_notes SET ${sets.join(', ')} WHERE id = ?`, values);
    saveToDisk(this.db);
  }

  async deleteStickyNote(id: string): Promise<void> {
    this.db.run('DELETE FROM sticky_notes WHERE id = ?', [id]);
    saveToDisk(this.db);
  }

  // ─── Note connections ───────────────────────────────────

  async getNoteConnectionsByBoardId(boardId: string): Promise<NoteConnectionRow[]> {
    return getAll(
      this.db,
      `SELECT nc.* FROM note_connections nc
         INNER JOIN sticky_notes sn ON sn.id = nc.note_id
         WHERE sn.board_id = ?`,
      [boardId]
    ) as unknown as NoteConnectionRow[];
  }

  async createNoteConnection(
    id: string,
    noteId: string,
    toType: NoteConnectionTargetType,
    toId: string
  ): Promise<NoteConnectionRow> {
    this.db.run(
      'INSERT INTO note_connections (id, note_id, to_type, to_id) VALUES (?, ?, ?, ?)',
      [id, noteId, toType, toId]
    );
    saveToDisk(this.db);
    const row = getOne(this.db, 'SELECT * FROM note_connections WHERE id = ?', [id]);
    return row as unknown as NoteConnectionRow;
  }

  async deleteNoteConnection(id: string): Promise<void> {
    this.db.run('DELETE FROM note_connections WHERE id = ?', [id]);
    saveToDisk(this.db);
  }

  async findNoteConnection(
    noteId: string,
    toType: NoteConnectionTargetType,
    toId: string
  ): Promise<NoteConnectionRow | undefined> {
    const row = getOne(
      this.db,
      'SELECT * FROM note_connections WHERE note_id = ? AND to_type = ? AND to_id = ?',
      [noteId, toType, toId]
    );
    return row as unknown as NoteConnectionRow | undefined;
  }
}