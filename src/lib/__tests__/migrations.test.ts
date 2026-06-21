import { setupTestDb, getTables, getColumns, getPragmaValue } from './testDb';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('Schema migrations', () => {
  it('runs all V1-V8 migrations without error and creates expected tables', async () => {
    const setup = await setupTestDb();
    try {
      const tables = getTables(setup.raw);

      const expectedTables = [
        'boards', 'projects', 'users', 'guests', 'sessions',
        'project_members', 'project_invites',
        'releases', 'sprints', 'tasks', 'dependencies',
        'sticky_notes', 'note_connections',
        'schema_migrations',
      ];

      for (const table of expectedTables) {
        expect(tables).toContain(table);
      }
    } finally {
      setup.cleanup();
    }
  });

  it('schema includes foreign key constraints', async () => {
    const setup = await setupTestDb();
    try {
      // Verify FK constraints are defined in the schema (they are per-connection
      // enforcement, which sql.js handles differently from native SQLite).
      // We check the schema definition, not runtime enforcement.
      const stmt = setup.raw.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'"
      );
      stmt.step();
      const sql = stmt.getAsObject().sql as string;
      expect(sql).toContain('FOREIGN KEY');
      stmt.free();
    } finally {
      setup.cleanup();
    }
  });

  it('creates boards.project_id column (V5)', async () => {
    const setup = await setupTestDb();
    try {
      expect(getColumns(setup.raw, 'boards')).toContain('project_id');
    } finally {
      setup.cleanup();
    }
  });

  it('creates projects.is_archived column (V7)', async () => {
    const setup = await setupDb();
    try {
      expect(getColumns(setup.raw, 'projects')).toContain('is_archived');
    } finally {
      setup.cleanup();
    }
  });

  it('creates tasks.is_critical column', async () => {
    const setup = await setupTestDb();
    try {
      expect(getColumns(setup.raw, 'tasks')).toContain('is_critical');
    } finally {
      setup.cleanup();
    }
  });

  it('creates sprints.start_date and end_date columns (V2)', async () => {
    const setup = await setupTestDb();
    try {
      const cols = getColumns(setup.raw, 'sprints');
      expect(cols).toContain('start_date');
      expect(cols).toContain('end_date');
    } finally {
      setup.cleanup();
    }
  });

  it('is idempotent — running getDb() twice does not re-run migrations', async () => {
    const setup = await setupTestDb();
    try {
      // Check that schema_migrations has all 8 versions recorded
      const stmt = setup.raw.prepare('SELECT version FROM schema_migrations ORDER BY version');
      const versions: number[] = [];
      while (stmt.step()) {
        versions.push(stmt.getAsObject().version as number);
      }
      stmt.free();

      expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

      // Re-run getDb() on the same file — migrations should be a no-op.
      // We simulate this by re-importing with the same data dir.
      const { getDb } = await import('../db/sqlite');
      const adapter2 = await getDb();
      // If migrations re-ran, they would fail with "column already exists" errors.
      // The fact that this doesn't throw proves idempotency.
      expect(adapter2).toBeDefined();
    } finally {
      setup.cleanup();
    }
  });
});

// Helper alias to avoid name clash
async function setupDb() {
  return setupTestDb();
}