/**
 * Database row types — snake_case matching SQLite column names.
 * These represent the raw storage format and NEVER leave the data layer.
 */
export interface BoardRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ReleaseRow {
  id: string;
  board_id: string;
  name: string;
  position: number;
  target_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface SprintRow {
  id: string;
  release_id: string;
  name: string;
  position: number;
  capacity: number;
  capacity_unit: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface TaskRow {
  id: string;
  sprint_id: string;
  title: string;
  description: string | null;
  estimate: number;
  color: string;
  is_critical: number; // SQLite boolean 0|1
  position: number;
  created_at: string;
}

export interface DependencyRow {
  id: string;
  from_task_id: string;
  to_task_id: string;
  created_at: string;
}