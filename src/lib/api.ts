import type {
  BoardState, CreateTaskInput, UpdateTaskInput,
  CreateReleaseInput, UpdateReleaseInput,
  CreateSprintInput, UpdateSprintInput,
  CreateStickyNoteInput, UpdateStickyNoteInput,
  CreateNoteConnectionInput,
  Task, Dependency, StickyNote, NoteConnection,
  Project, Session, ProjectMember, ProjectInvite,
  CreateProjectInput, RegisterInput, LoginInput, JoinAsGuestInput,
  MemberType, MemberRole,
} from '@/lib/types';

const BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('soulplan-session-token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Board ─────────────────────────────────────────────────

export function fetchBoard(boardId?: string): Promise<BoardState> {
  const qs = boardId ? `?boardId=${encodeURIComponent(boardId)}` : '';
  return request<BoardState>(`/board${qs}`);
}

// ─── Releases ─────────────────────────────────────────────

export function createRelease(input: CreateReleaseInput): Promise<unknown> {
  return request('/releases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRelease(id: string, input: Omit<UpdateReleaseInput, 'id'>): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/releases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteRelease(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/releases/${id}`, {
    method: 'DELETE',
  });
}

// ─── Sprints ──────────────────────────────────────────────

export function createSprint(input: CreateSprintInput): Promise<unknown> {
  return request('/sprints', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSprint(id: string, input: Omit<UpdateSprintInput, 'id'>): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/sprints/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteSprint(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/sprints/${id}`, {
    method: 'DELETE',
  });
}

// ─── Tasks ────────────────────────────────────────────────

export function createTask(input: CreateTaskInput): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTask(input: UpdateTaskInput): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/tasks', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTask(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/tasks', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}

// ─── Dependencies ──────────────────────────────────────────

export function createDependency(fromTaskId: string, toTaskId: string): Promise<Dependency> {
  return request<Dependency>('/dependencies', {
    method: 'POST',
    body: JSON.stringify({ fromTaskId, toTaskId }),
  });
}

export function deleteDependency(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/dependencies', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}

// ─── Sticky notes ─────────────────────────────────────────

export function createStickyNote(input: CreateStickyNoteInput): Promise<StickyNote> {
  return request<StickyNote>('/sticky-notes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateStickyNote(
  id: string,
  input: Omit<UpdateStickyNoteInput, 'id'>
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/sticky-notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteStickyNote(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/sticky-notes/${id}`, {
    method: 'DELETE',
  });
}

// ─── Note connections ─────────────────────────────────────

export function createNoteConnection(
  input: CreateNoteConnectionInput
): Promise<NoteConnection> {
  return request<NoteConnection>('/note-connections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteNoteConnection(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/note-connections', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}

// ─── Projects ─────────────────────────────────────────────

export function fetchProjects(): Promise<Project[]> {
  return request<Project[]>('/projects');
}

export function fetchProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`);
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProject(id: string, input: { name?: string; isArchived?: boolean }): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function archiveProject(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isArchived: true }),
  });
}

export function unarchiveProject(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isArchived: false }),
  });
}

export function fetchArchivedProjects(): Promise<Project[]> {
  return request<Project[]>('/projects?archived=true');
}

export function deleteProject(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${id}`, {
    method: 'DELETE',
  });
}

// ─── Project Members ──────────────────────────────────────

export function fetchProjectMembers(projectId: string): Promise<ProjectMember[]> {
  return request<ProjectMember[]>(`/projects/${projectId}/members`);
}

export function addProjectMember(
  projectId: string,
  memberType: MemberType,
  memberId: string,
  role?: MemberRole
): Promise<ProjectMember> {
  return request<ProjectMember>(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ memberType, memberId, role }),
  });
}

export function removeProjectMember(projectId: string, memberRowId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${projectId}/members/${memberRowId}`, {
    method: 'DELETE',
  });
}

// ─── Project Invites ──────────────────────────────────────

export function fetchProjectInvites(projectId: string): Promise<ProjectInvite[]> {
  return request<ProjectInvite[]>(`/projects/${projectId}/invites`);
}

export function createProjectInvite(projectId: string, role?: MemberRole): Promise<ProjectInvite> {
  return request<ProjectInvite>(`/projects/${projectId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ role: role ?? 'editor' }),
  });
}

export function revokeProjectInvite(projectId: string, inviteId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${projectId}/invites`, {
    method: 'DELETE',
    body: JSON.stringify({ inviteId }),
  });
}

/** Preview an invite without accepting — returns project name + role. */
export function previewInvite(token: string): Promise<{ projectName: string; role: MemberRole; projectId: string }> {
  return request(`/invites/accept?token=${encodeURIComponent(token)}`);
}

/** Accept an invite: creates a guest account, adds them to the project, returns session. */
export function acceptInvite(token: string, name: string): Promise<{
  guest: { id: string; name: string; createdAt: string };
  session: Session;
  project: Project;
  invite: ProjectInvite;
}> {
  return request('/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token, name }),
  });
}

// ─── Auth ─────────────────────────────────────────────────

export function registerUser(input: RegisterInput): Promise<{ user: { id: string; username: string; displayName: string | null }; session: Session }> {
  return request('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'register', ...input }),
  });
}

export function loginUser(input: LoginInput): Promise<{ user: { id: string; username: string; displayName: string | null }; session: Session }> {
  return request('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', ...input }),
  });
}

export function joinAsGuest(input: JoinAsGuestInput): Promise<{ guest: { id: string; name: string }; session: Session }> {
  return request('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'guest', ...input }),
  });
}

export function verifySession(): Promise<{ authenticated: boolean; session?: Session }> {
  return request('/auth');
}

export function logout(): Promise<{ success: boolean }> {
  return request('/auth', { method: 'DELETE' });
}