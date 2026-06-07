import type {
  BoardState, CreateTaskInput, UpdateTaskInput,
  CreateReleaseInput, UpdateReleaseInput,
  CreateSprintInput, UpdateSprintInput,
  CreateStickyNoteInput, UpdateStickyNoteInput,
  CreateNoteConnectionInput,
  Task, Dependency, StickyNote, NoteConnection,
} from '@/lib/types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Board ─────────────────────────────────────────────────

export function fetchBoard(): Promise<BoardState> {
  return request<BoardState>('/board');
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