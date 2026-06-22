import type {
  BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow,
  StickyNoteRow, NoteConnectionRow, NoteConnectionTargetType,
  ProjectRow, UserRow, GuestRow, ProjectMemberRow, ProjectInviteRow, SessionRow,
  JiraConfigRow, JiraSyncLogRow,
  MemberType, MemberRole,
} from './types';

/**
 * Database adapter interface.
 * Swappable implementation — sql.js for universal compat, Postgres for production.
 * All methods return raw DB rows (snake_case). Transform to camelCase in the service layer.
 *
 * Since sql.js (WASM) requires async initialization, all methods are async.
 */
export interface IDatabase {
  // ─── Lifecycle ─────────────────────────────────────────
  close(): void;

  // ─── Boards ──────────────────────────────────────────────
  getBoard(id: string): Promise<BoardRow | undefined>;
  getAllBoards(): Promise<BoardRow[]>;
  getBoardsByProjectId(projectId: string): Promise<BoardRow[]>;
  createBoard(id: string, name: string, projectId?: string | null): Promise<BoardRow>;
  updateBoardName(id: string, name: string): Promise<void>;
  updateBoardUpdatedAt(id: string): Promise<void>;

  // ─── Projects ─────────────────────────────────────────────
  getProject(id: string): Promise<ProjectRow | undefined>;
  getAllProjects(includeArchived?: boolean): Promise<ProjectRow[]>;
  getArchivedProjects(): Promise<ProjectRow[]>;
  createProject(id: string, name: string, ownerId?: string | null): Promise<ProjectRow>;
  updateProject(id: string, fields: Record<string, unknown>): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // ─── Users ────────────────────────────────────────────────
  getUser(id: string): Promise<UserRow | undefined>;
  getUserByUsername(username: string): Promise<UserRow | undefined>;
  createUser(id: string, username: string, passwordHash: string, displayName?: string | null): Promise<UserRow>;

  // ─── Guests ───────────────────────────────────────────────
  getGuest(id: string): Promise<GuestRow | undefined>;
  createGuest(id: string, name: string): Promise<GuestRow>;

  // ─── Project Members ──────────────────────────────────────
  getProjectMembers(projectId: string): Promise<ProjectMemberRow[]>;
  getProjectsByMemberId(memberId: string, includeArchived?: boolean): Promise<ProjectRow[]>;
  addProjectMember(id: string, projectId: string, memberType: MemberType, memberId: string, role: MemberRole): Promise<ProjectMemberRow>;
  removeProjectMember(id: string): Promise<void>;
  findProjectMember(projectId: string, memberId: string): Promise<ProjectMemberRow | undefined>;

  // ─── Project Invites ─────────────────────────────────────
  createInvite(id: string, projectId: string, token: string, role: MemberRole, expiresAt: string | null): Promise<ProjectInviteRow>;
  getInviteByToken(token: string): Promise<ProjectInviteRow | undefined>;
  getInvitesByProjectId(projectId: string): Promise<ProjectInviteRow[]>;
  deleteInvite(id: string): Promise<void>;

  // ─── Sessions ─────────────────────────────────────────────
  createSession(token: string, memberType: MemberType, memberId: string, displayName: string): Promise<SessionRow>;
  getSession(token: string): Promise<SessionRow | undefined>;
  deleteSession(token: string): Promise<void>;

  // ─── Releases ─────────────────────────────────────────────
  getReleasesByBoardId(boardId: string): Promise<ReleaseRow[]>;
  createRelease(id: string, boardId: string, name: string, position: number): Promise<ReleaseRow>;
  updateRelease(id: string, fields: Record<string, unknown>): Promise<void>;
  deleteRelease(id: string): Promise<void>;

  // ─── Sprints ────────────────────────────────────────────
  getSprintsByReleaseIds(releaseIds: string[]): Promise<SprintRow[]>;
  createSprint(id: string, releaseId: string, name: string, position: number): Promise<SprintRow>;
  updateSprint(id: string, fields: Record<string, unknown>): Promise<void>;
  deleteSprint(id: string): Promise<void>;

  // ─── Tasks ───────────────────────────────────────────────
  getTasksBySprintIds(sprintIds: string[]): Promise<TaskRow[]>;
  createTask(id: string, sprintId: string, title: string, position: number): Promise<TaskRow>;
  updateTask(id: string, fields: Record<string, unknown>): Promise<void>;
  deleteTask(id: string): Promise<void>;
  getMaxTaskPosition(sprintId: string): Promise<number>;

  // ─── Dependencies ──────────────────────────────────────
  getDependenciesByTaskIds(taskIds: string[]): Promise<DependencyRow[]>;
  createDependency(id: string, fromTaskId: string, toTaskId: string): Promise<DependencyRow>;
  deleteDependency(id: string): Promise<void>;
  deleteDependenciesByTaskId(taskId: string): Promise<void>;
  findDependency(fromTaskId: string, toTaskId: string): Promise<DependencyRow | undefined>;

  // ─── Sticky notes ────────────────────────────────────────
  getStickyNotesByBoardId(boardId: string): Promise<StickyNoteRow[]>;
  createStickyNote(
    id: string,
    boardId: string,
    text: string,
    x: number,
    y: number,
    color: string,
    z: number
  ): Promise<StickyNoteRow>;
  updateStickyNote(id: string, fields: Record<string, unknown>): Promise<void>;
  deleteStickyNote(id: string): Promise<void>;

  // ─── Note connections ───────────────────────────────────
  getNoteConnectionsByBoardId(boardId: string): Promise<NoteConnectionRow[]>;
  createNoteConnection(
    id: string,
    noteId: string,
    toType: NoteConnectionTargetType,
    toId: string
  ): Promise<NoteConnectionRow>;
  deleteNoteConnection(id: string): Promise<void>;
  findNoteConnection(
    noteId: string,
    toType: NoteConnectionTargetType,
    toId: string
  ): Promise<NoteConnectionRow | undefined>;

  // ─── Jira config ─────────────────────────────────────────
  getJiraConfig(projectId: string): Promise<JiraConfigRow | undefined>;
  createJiraConfig(
    id: string, projectId: string, baseUrl: string, jiraType: string,
    email: string | null, encryptedToken: string | null, boardId: string | null
  ): Promise<JiraConfigRow>;
  updateJiraConfig(id: string, fields: Record<string, unknown>): Promise<void>;
  deleteJiraConfig(id: string): Promise<void>;

  // ─── Jira sync log ───────────────────────────────────────
  insertSyncLog(
    id: string, projectId: string, direction: string, entityType: string,
    entityId: string | null, jiraId: string | null, action: string, details: string | null
  ): Promise<JiraSyncLogRow>;
  getSyncLogs(projectId: string, limit?: number): Promise<JiraSyncLogRow[]>;
}