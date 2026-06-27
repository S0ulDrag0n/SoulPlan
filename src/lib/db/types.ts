/**
 * Database row types — snake_case matching SQLite column names.
 * These represent the raw storage format and NEVER leave the data layer.
 */
export interface BoardRow {
  id: string;
  name: string;
  project_id: string | null; // V5 — nullable for migration period
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  owner_id: string | null; // FK to users.id (nullable for migration period)
  is_archived: number; // SQLite boolean 0|1
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  created_at: string;
}

export interface GuestRow {
  id: string;
  name: string;
  created_at: string;
}

export type MemberType = 'user' | 'guest';
export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  member_type: MemberType;
  member_id: string;
  role: MemberRole;
  created_at: string;
}

export interface ProjectInviteRow {
  id: string;
  project_id: string;
  token: string;
  role: MemberRole;
  created_at: string;
  expires_at: string | null;
}

export interface SessionRow {
  token: string;
  member_type: MemberType;
  member_id: string;
  display_name: string;
  created_at: string;
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

export interface StickyNoteRow {
  id: string;
  board_id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  z: number;
  created_at: string;
  updated_at: string;
}

export type NoteConnectionTargetType = 'task' | 'sprint' | 'release';

export interface NoteConnectionRow {
  id: string;
  note_id: string;
  to_type: NoteConnectionTargetType;
  to_id: string;
  created_at: string;
}

export interface ActivityLogRow {
  id: string;
  project_id: string;
  member_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  detail: string | null;
  created_at: string;
}