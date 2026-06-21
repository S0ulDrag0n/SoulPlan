import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

/**
 * Creates an isolated test database using the REAL db/sqlite.ts module.
 * Each call resets the module cache and points process.cwd() at a fresh temp
 * directory, so DATA_DIR resolves to the temp path and getDb() creates a new
 * database there. This tests the actual migration logic, not a copy.
 *
 * Returns the adapter (IDatabase), the underlying sql.js database (loaded from
 * the temp file for schema inspection), and a cleanup function.
 */

export interface TestDbSetup {
  /** The IDatabase adapter from getDb(). */
  adapter: Awaited<ReturnType<typeof import('../db/sqlite').getDb>>;
  /** A separate sql.js instance loaded from the temp file, for schema inspection. */
  raw: SqlJsDatabase;
  dataDir: string;
  cleanup: () => void;
}

export async function setupTestDb(): Promise<TestDbSetup> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulplan-test-'));
  const originalCwd = process.cwd();
  process.chdir(dataDir);
  jest.resetModules();

  // Import the REAL db/sqlite module (fresh after resetModules)
  const { getDb } = await import('../db/sqlite');
  const adapter = await getDb();

  // Load the DB file into a separate sql.js instance for schema queries.
  // DATA_DIR is path.join(process.cwd(), 'data'), so the file is in data/soul-plan.db.
  const dbPath = path.join(dataDir, 'data', 'soul-plan.db');
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const raw = new SQL.Database(buffer);

  return {
    adapter,
    raw,
    dataDir,
    cleanup: () => {
      process.chdir(originalCwd);
      try { raw.close(); } catch { /* */ }
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

// ─── Schema inspection helpers ────────────────────────────

export function getTables(db: SqlJsDatabase): string[] {
  const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables: string[] = [];
  while (stmt.step()) {
    tables.push(stmt.getAsObject().name as string);
  }
  stmt.free();
  return tables;
}

export function getColumns(db: SqlJsDatabase, tableName: string): string[] {
  const stmt = db.prepare(`PRAGMA table_info(${tableName})`);
  const cols: string[] = [];
  while (stmt.step()) {
    cols.push(stmt.getAsObject().name as string);
  }
  stmt.free();
  return cols;
}

export function getPragmaValue(db: SqlJsDatabase, pragma: string): unknown {
  const stmt = db.prepare(`PRAGMA ${pragma}`);
  let value: unknown = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    // PRAGMA foreign_keys returns { foreign_keys: 1 }
    const keys = Object.keys(row);
    if (keys.length > 0) value = row[keys[0]];
  }
  stmt.free();
  return value;
}