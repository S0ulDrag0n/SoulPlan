'use client';

import { useCallback } from 'react';
import type { BoardState } from '@/lib/types';
import * as api from '@/lib/api';

export function useTaskMutations(boardState: BoardState | null, onBoardUpdate: () => void) {
  const moveTask = useCallback(async (taskId: string, targetSprintId: string) => {
    // Optimistic update
    if (boardState) {
      const task = findTaskById(boardState, taskId);
      if (task) {
        const updates = { sprintId: targetSprintId, position: task.position };
        await api.updateTask(taskId, updates);
        onBoardUpdate();
      }
    }
  }, [boardState, onBoardUpdate]);

  const createTask = useCallback(async (sprintId: string, title: string) => {
    await api.createTask({ sprintId, title, position: 0 });
    onBoardUpdate();
  }, [onBoardUpdate]);

  const saveTask = useCallback(async (task: Parameters<typeof api.updateTask>[1]) => {
    await updateTask(task.id, task);
    onBoardUpdate();
  }, [onBoardUpdate]);

  const deleteTask = useCallback(async (id: string) => {
    await api.deleteTask(id);
    onBoardUpdate();
  }, [onBoardUpdate]);

  const reorderTasks = useCallback(async (positionUpdates: Array<{ id: string; position: number }>) => {
    await Promise.all(
      positionUpdates.map(({ id, position }) => api.updateTask(id, { position }))
    );
    onBoardUpdate();
  }, [onBoardUpdate]);

  // Simple saving state — true when any mutation is in flight
  // For a more robust version, track a counter or use react-query
  const [saving, setSaving] = useState(false);

  const wrappedMoveTask = useCallback(async (taskId: string, targetSprintId: string) => {
    setSaving(true);
    try { await moveTask(taskId, targetSprintId); }
    finally { setSaving(false); }
  }, [moveTask]);

  const wrappedCreateTask = useCallback(async (sprintId: string, title: string) => {
    setSaving(true);
    try { await createTask(sprintId, title); }
    finally { setSaving(false); }
  }, [createTask]);

  const wrappedSaveTask = useCallback(async (task: any) => {
    setSaving(true);
    try { await saveTask(task); }
    finally { setSaving(false); }
  }, [saveTask]);

  const wrappedDeleteTask = useCallback(async (id: string) => {
    setSaving(true);
    try { await deleteTask(id); }
    finally { setSaving(false); }
  }, [deleteTask]);

  const wrappedReorderTasks = useCallback(async (positionUpdates: Array<{ id: string; position: number }>) => {
    setSaving(true);
    try { await reorderTasks(positionUpdates); }
    finally { setSaving(false); }
  }, [reorderTasks]);

  return {
    saving,
    moveTask: wrappedMoveTask,
    createTask: wrappedCreateTask,
    saveTask: wrappedSaveTask,
    deleteTask: wrappedDeleteTask,
    reorderTasks: wrappedReorderTasks,
  };
}

import { useState } from 'react';

function findTaskById(boardState: BoardState, taskId: string) {
  for (const release of boardState.releases) {
    for (const sprint of release.sprints) {
      const task = sprint.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
  }
  return undefined;
}