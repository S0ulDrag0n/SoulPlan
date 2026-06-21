import { randomUUID } from 'crypto';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import type { IDatabase } from './db/adapter';
import { getDb } from './db/sqlite';
import {
  toBoard, toRelease, toSprint, toTask, toDependency,
  toStickyNote, toNoteConnection,
  toProject, toUser, toGuest, toProjectMember, toProjectInvite, toSession,
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
  Project, User, Guest, ProjectMember, ProjectInvite, Session,
  MemberType, MemberRole,
  CreateProjectInput, UpdateProjectInput,
  RegisterInput, LoginInput, JoinAsGuestInput,
  ProjectExport, ProjectImportPayload, ProjectImportResult,
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
    // No boards — create a default project + board so the app works standalone.
    const project = await db.createProject(randomUUID(), 'Default Project', null);
    const board = await db.createBoard(randomUUID(), 'SoulPlan Board', project.id);
    boardId = board.id;
  } else {
    boardId = boards[0].id;
  }

  const state = await getFullBoardState(boardId);
  if (!state) throw new Error('Failed to load board state');
  return state;
}

export async function getBoardsByProjectId(projectId: string): Promise<BoardState[]> {
  const db: IDatabase = await getDb();
  const boards = await db.getBoardsByProjectId(projectId);
  const states: BoardState[] = [];
  for (const board of boards) {
    const state = await getFullBoardState(board.id);
    if (state) states.push(state);
  }
  return states;
}

/** Create a default board for a project that has none yet, return its state. */
export async function createDefaultBoardForProject(projectId: string): Promise<BoardState> {
  const db: IDatabase = await getDb();
  const project = await db.getProject(projectId);
  if (!project) throw new Error('Project not found');
  const row = await db.createBoard(randomUUID(), 'Main Board', projectId);
  const state = await getFullBoardState(row.id);
  if (!state) throw new Error('Failed to load board state');
  return state;
}

export async function updateBoardName(boardId: string, name: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.updateBoardName(boardId, name);
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

// ─── Project queries ─────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const db: IDatabase = await getDb();
  const rows = await db.getAllProjects();
  return rows.map(toProject);
}

export async function getArchivedProjects(): Promise<Project[]> {
  const db: IDatabase = await getDb();
  const rows = await db.getArchivedProjects();
  return rows.map(toProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const db: IDatabase = await getDb();
  const row = await db.getProject(id);
  return row ? toProject(row) : null;
}

export async function createProject(input: CreateProjectInput, ownerId: string | null = null): Promise<Project> {
  const db: IDatabase = await getDb();
  const row = await db.createProject(randomUUID(), input.name, ownerId);
  // If owner is a user, auto-add them as a project member with 'owner' role.
  if (ownerId) {
    await db.addProjectMember(randomUUID(), row.id, 'user', ownerId, 'owner');
  }
  return toProject(row);
}

export async function updateProject(input: UpdateProjectInput): Promise<void> {
  const db: IDatabase = await getDb();
  const fields: Record<string, unknown> = {};
  if (input.name !== undefined) fields.name = input.name;
  if (input.isArchived !== undefined) fields.is_archived = input.isArchived ? 1 : 0;
  await db.updateProject(input.id, fields);
}

export async function deleteProject(id: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.deleteProject(id);
}

// ─── Auth queries (users, guests, sessions) ──────────────

/** Hash a password using scrypt. Returns `salt:hash` (both hex). */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Verify a password against a stored `salt:hash` string. */
function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const testHash = scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, 'hex');
  // timingSafeEqual requires same length buffers
  if (testHash.length !== hashBuf.length) return false;
  return timingSafeEqual(testHash, hashBuf);
}

/** Generate a random session token. */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function registerUser(input: RegisterInput): Promise<{ user: User; session: Session }> {
  const db: IDatabase = await getDb();
  // Check username uniqueness
  const existing = await db.getUserByUsername(input.username);
  if (existing) {
    throw new Error('Username already taken');
  }
  const passwordHash = hashPassword(input.password);
  const row = await db.createUser(randomUUID(), input.username, passwordHash, input.displayName ?? null);
  const user = toUser(row);
  const session = await createSessionInternal(db, 'user', user.id, user.displayName ?? user.username);
  return { user, session };
}

export async function loginUser(input: LoginInput): Promise<{ user: User; session: Session }> {
  const db: IDatabase = await getDb();
  const row = await db.getUserByUsername(input.username);
  if (!row) {
    throw new Error('Invalid username or password');
  }
  if (!verifyPassword(input.password, row.password_hash)) {
    throw new Error('Invalid username or password');
  }
  const user = toUser(row);
  const session = await createSessionInternal(db, 'user', user.id, user.displayName ?? user.username);
  return { user, session };
}

export async function joinAsGuest(input: JoinAsGuestInput): Promise<{ guest: Guest; session: Session }> {
  const db: IDatabase = await getDb();
  const row = await db.createGuest(randomUUID(), input.name);
  const guest = toGuest(row);
  const session = await createSessionInternal(db, 'guest', guest.id, guest.name);
  return { guest, session };
}

async function createSessionInternal(
  db: IDatabase,
  memberType: MemberType,
  memberId: string,
  displayName: string
): Promise<Session> {
  const token = generateToken();
  const row = await db.createSession(token, memberType, memberId, displayName);
  return toSession(row);
}

export async function getSessionByToken(token: string): Promise<Session | null> {
  const db: IDatabase = await getDb();
  const row = await db.getSession(token);
  return row ? toSession(row) : null;
}

export async function deleteSession(token: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.deleteSession(token);
}

// ─── Project member queries ──────────────────────────────

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const db: IDatabase = await getDb();
  const rows = await db.getProjectMembers(projectId);
  return rows.map(toProjectMember);
}

export async function getProjectsByMemberId(memberId: string, includeArchived: boolean = false): Promise<Project[]> {
  const db: IDatabase = await getDb();
  const rows = await db.getProjectsByMemberId(memberId, includeArchived);
  return rows.map(toProject);
}

export async function addProjectMember(
  projectId: string,
  memberType: MemberType,
  memberId: string,
  role: MemberRole = 'editor'
): Promise<ProjectMember> {
  const db: IDatabase = await getDb();
  // Idempotent: if already a member, return existing.
  const existing = await db.findProjectMember(projectId, memberId);
  if (existing) return toProjectMember(existing);
  const row = await db.addProjectMember(randomUUID(), projectId, memberType, memberId, role);
  return toProjectMember(row);
}

export async function removeProjectMember(id: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.removeProjectMember(id);
}

// ─── Project invite queries ──────────────────────────────

export async function createInvite(projectId: string, role: MemberRole = 'editor'): Promise<ProjectInvite> {
  const db: IDatabase = await getDb();
  const token = generateToken();
  const row = await db.createInvite(randomUUID(), projectId, token, role, null);
  return toProjectInvite(row);
}

export async function getInviteByToken(token: string): Promise<ProjectInvite | null> {
  const db: IDatabase = await getDb();
  const row = await db.getInviteByToken(token);
  return row ? toProjectInvite(row) : null;
}

export async function getInvitesByProjectId(projectId: string): Promise<ProjectInvite[]> {
  const db: IDatabase = await getDb();
  const rows = await db.getInvitesByProjectId(projectId);
  return rows.map(toProjectInvite);
}

export async function deleteInvite(id: string): Promise<void> {
  const db: IDatabase = await getDb();
  await db.deleteInvite(id);
}

/**
 * Accept an invite: create a guest account, add them as a project member,
 * and return their session. The invite token remains valid for reuse
 * (multiple people can use the same link).
 */
export async function acceptInvite(
  token: string,
  guestName: string
): Promise<{ guest: Guest; session: Session; project: Project; invite: ProjectInvite }> {
  const db: IDatabase = await getDb();
  const invite = await getInviteByToken(token);
  if (!invite) {
    throw new Error('Invalid or expired invite link');
  }

  const project = await getProject(invite.projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  // Create guest account
  const guestRow = await db.createGuest(randomUUID(), guestName);
  const guest = toGuest(guestRow);

  // Add as project member with the invite's role
  await db.addProjectMember(randomUUID(), invite.projectId, 'guest', guest.id, invite.role);

  // Create session
  const session = await createSessionInternal(db, 'guest', guest.id, guest.name);

  return { guest, session, project, invite };
}

// ─── Export / Import queries ──────────────────────────────

/**
 * Export a full project: the project row plus every board (with its
 * releases → sprints → tasks tree, dependencies, sticky notes, and note
 * connections). Returns a portable JSON snapshot.
 *
 * Returns null if the project does not exist.
 */
export async function exportProject(projectId: string): Promise<ProjectExport | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const boards = await getBoardsByProjectId(projectId);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project,
    boards,
  };
}

/**
 * Import a previously-exported project snapshot into a NEW project owned by
 * `ownerId`. Every entity (board, release, sprint, task, dependency, sticky
 * note, note connection) is recreated with a fresh UUID, and all parent/child
 * references are remapped via ID maps so the imported tree is internally
 * consistent and never collides with existing rows.
 *
 * The new project's name comes from `payload.project.name` (allowing the
 * caller to rename on import). The supplied `projectId` path param is NOT
 * used as the new project ID — a fresh UUID is generated.
 */
export async function importProject(
  payload: ProjectImportPayload,
  ownerId: string | null = null
): Promise<ProjectImportResult> {
  const db: IDatabase = await getDb();

  // 1. Create the new project (this also auto-adds the owner as a member
  //    via createProject when ownerId is provided).
  const project = await createProject({ name: payload.project.name }, ownerId);

  // ID maps: oldId → newId, populated as each entity is created.
  const boardIdMap = new Map<string, string>();
  const releaseIdMap = new Map<string, string>();
  const sprintIdMap = new Map<string, string>();
  const taskIdMap = new Map<string, string>();
  const stickyNoteIdMap = new Map<string, string>();

  for (const boardState of payload.boards) {
    const newBoardId = randomUUID();
    const boardRow = await db.createBoard(newBoardId, boardState.board.name, project.id);
    boardIdMap.set(boardState.board.id, boardRow.id);

    for (const release of boardState.releases) {
      const newReleaseId = randomUUID();
      const releaseRow = await db.createRelease(newReleaseId, boardRow.id, release.name, release.position);
      releaseIdMap.set(release.id, releaseRow.id);
      // Restore optional release fields (targetDate, notes) that createRelease doesn't set.
      const releaseFields: Record<string, unknown> = {};
      if (release.targetDate !== null && release.targetDate !== undefined) releaseFields.target_date = release.targetDate;
      if (release.notes !== null && release.notes !== undefined) releaseFields.notes = release.notes;
      if (Object.keys(releaseFields).length > 0) await db.updateRelease(releaseRow.id, releaseFields);

      for (const sprint of release.sprints) {
        const newSprintId = randomUUID();
        const sprintRow = await db.createSprint(newSprintId, releaseRow.id, sprint.name, sprint.position);
        sprintIdMap.set(sprint.id, sprintRow.id);
        // Restore optional sprint fields.
        const sprintFields: Record<string, unknown> = {};
        if (sprint.capacity !== undefined) sprintFields.capacity = sprint.capacity;
        if (sprint.capacityUnit !== undefined) sprintFields.capacity_unit = sprint.capacityUnit;
        if (sprint.startDate !== null && sprint.startDate !== undefined) sprintFields.start_date = sprint.startDate;
        if (sprint.endDate !== null && sprint.endDate !== undefined) sprintFields.end_date = sprint.endDate;
        if (sprint.notes !== null && sprint.notes !== undefined) sprintFields.notes = sprint.notes;
        if (Object.keys(sprintFields).length > 0) await db.updateSprint(sprintRow.id, sprintFields);

        for (const task of sprint.tasks) {
          const newTaskId = randomUUID();
          const taskRow = await db.createTask(newTaskId, sprintRow.id, task.title, task.position);
          taskIdMap.set(task.id, taskRow.id);
          // Restore optional task fields.
          const taskFields: Record<string, unknown> = {};
          if (task.description !== null && task.description !== undefined) taskFields.description = task.description;
          if (task.estimate !== undefined) taskFields.estimate = task.estimate;
          if (task.color !== undefined) taskFields.color = task.color;
          if (task.isCritical !== undefined) taskFields.is_critical = task.isCritical ? 1 : 0;
          if (Object.keys(taskFields).length > 0) await db.updateTask(taskRow.id, taskFields);
        }
      }
    }

    // Dependencies — remap from/to task IDs. Skip any whose tasks weren't
    // imported (defensive: a dependency could reference a task outside this
    // board in a multi-board project; we only have this board's tasks).
    for (const dep of boardState.dependencies) {
      const newFrom = taskIdMap.get(dep.fromTaskId);
      const newTo = taskIdMap.get(dep.toTaskId);
      if (!newFrom || !newTo) continue;
      await db.createDependency(randomUUID(), newFrom, newTo);
    }

    // Sticky notes — remap board ID.
    for (const note of boardState.stickyNotes) {
      const newNoteId = randomUUID();
      const noteRow = await db.createStickyNote(
        newNoteId,
        boardRow.id,
        note.text,
        note.x,
        note.y,
        note.color,
        note.z
      );
      stickyNoteIdMap.set(note.id, noteRow.id);
    }

    // Note connections — remap noteId and toId (task/sprint/release).
    for (const conn of boardState.noteConnections) {
      const newNoteId = stickyNoteIdMap.get(conn.noteId);
      if (!newNoteId) continue;
      let newToId: string | undefined;
      if (conn.toType === 'task') newToId = taskIdMap.get(conn.toId);
      else if (conn.toType === 'sprint') newToId = sprintIdMap.get(conn.toId);
      else if (conn.toType === 'release') newToId = releaseIdMap.get(conn.toId);
      if (!newToId) continue;
      await db.createNoteConnection(randomUUID(), newNoteId, conn.toType, newToId);
    }
  }

  return { project };
}