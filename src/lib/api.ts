import type { BoardState } from './types';

const API_BASE = '/api';

// ─── Generic helpers ──────────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  // DELETE may return empty body
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  return res.json();
}

// ─── Boards ───────────────────────────────────────────────
export async function getBoard(id: string): Promise<BoardState> {
  return request<BoardState>(`/boards/${id}/state`);
}

// ─── Releases ─────────────────────────────────────────────
export async function createRelease(data: { boardId: string; name: string }) {
  return request('/releases', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateRelease(id: string, data: Record<string, unknown>) {
  return request(`/releases/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteRelease(id: string) {
  return request(`/releases/${id}`, { method: 'DELETE' });
}

// ─── Sprints ──────────────────────────────────────────────
export async function createSprint(data: { releaseId: string; name: string }) {
  return request('/sprints', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateSprint(id: string, data: Record<string, unknown>) {
  return request(`/sprints/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteSprint(id: string) {
  return request(`/sprints/${id}`, { method: 'DELETE' });
}

// ─── Tasks ────────────────────────────────────────────────
export async function createTask(data: { sprintId: string; title: string; position?: number }) {
  return request('/tasks', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateTask(id: string, data: Record<string, unknown>) {
  return request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteTask(id: string) {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

// ─── Dependencies ─────────────────────────────────────────
export async function createDependency(fromTaskId: string, toTaskId: string) {
  return request('/dependencies', {
    method: 'POST',
    body: JSON.stringify({ fromTaskId, toTaskId }),
  });
}
export async function deleteDependency(id: string) {
  return request(`/dependencies/${id}`, { method: 'DELETE' });
}