import type { BoardState, CreateTaskInput, UpdateTaskInput, CreateReleaseInput, CreateSprintInput, Task } from '@/lib/types';

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

// ─── Sprints ──────────────────────────────────────────────

export function createSprint(input: CreateSprintInput): Promise<unknown> {
  return request('/sprints', {
    method: 'POST',
    body: JSON.stringify(input),
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