/**
 * Frontend types — camelCase, clean, and UI-friendly.
 * These are what React components and API responses consume.
 * Converted from DB row types via pure transform functions in transform.ts.
 */
export interface Board {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Release {
  id: string;
  boardId: string;
  name: string;
  position: number;
  targetDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Sprint {
  id: string;
  releaseId: string;
  name: string;
  position: number;
  capacity: number;
  capacityUnit: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  sprintId: string;
  title: string;
  description: string | null;
  estimate: number;
  color: string;
  isCritical: boolean;
  position: number;
  createdAt: string;
}

export interface Dependency {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  createdAt: string;
}

/** Free-floating sticky note on the board canvas. (x, y) are in pan-space coords. */
export interface StickyNote {
  id: string;
  boardId: string;
  text: string;
  x: number;
  y: number;
  color: string;
  z: number;
  createdAt: string;
  updatedAt: string;
}

/** Polymorphic target type for a note connection. */
export type NoteConnectionTargetType = 'task' | 'sprint' | 'release';

/** A connection from a sticky note to a task, sprint, or release. */
export interface NoteConnection {
  id: string;
  noteId: string;
  toType: NoteConnectionTargetType;
  toId: string;
  createdAt: string;
}

/** Nested board state returned by GET /api/board */
export interface BoardState {
  board: Board;
  releases: (Release & {
    sprints: (Sprint & { tasks: Task[] })[];
  })[];
  dependencies: Dependency[];
  stickyNotes: StickyNote[];
  noteConnections: NoteConnection[];
}

/** Release with nested sprints & tasks — as used in BoardState */
export type ReleaseWithSprints = Release & {
  sprints: SprintWithTasks[];
};

/** Sprint with nested tasks — as used in BoardState */
export type SprintWithTasks = Sprint & {
  tasks: Task[];
};

/** Input shape for creating a task */
export interface CreateTaskInput {
  sprintId: string;
  title: string;
}

/** Input shape for updating a task — all fields optional except id */
export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string | null;
  estimate?: number;
  color?: string;
  isCritical?: boolean;
  sprintId?: string;
  position?: number;
}

/** Input shape for creating a release */
export interface CreateReleaseInput {
  boardId: string;
  name: string;
}

/** Input shape for updating a release */
export interface UpdateReleaseInput {
  id: string;
  name?: string;
  targetDate?: string | null;
  notes?: string | null;
}

/** Input shape for creating a sprint */
export interface CreateSprintInput {
  releaseId: string;
  name: string;
}

/** Input shape for updating a sprint */
export interface UpdateSprintInput {
  id: string;
  name?: string;
  capacity?: number;
  capacityUnit?: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

/** Input shape for creating a sticky note. x/y are pan-space coords. */
export interface CreateStickyNoteInput {
  boardId: string;
  text?: string;
  x: number;
  y: number;
  color?: string;
}

/** Input shape for updating a sticky note. */
export interface UpdateStickyNoteInput {
  id: string;
  text?: string;
  x?: number;
  y?: number;
  color?: string;
  z?: number;
}

/** Input shape for creating a note connection. */
export interface CreateNoteConnectionInput {
  noteId: string;
  toType: NoteConnectionTargetType;
  toId: string;
}
