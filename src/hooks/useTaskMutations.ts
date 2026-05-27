'use client';

import { useState } from 'react';
import type { Task, UpdateTaskInput } from '@/lib/types';
import { moveTaskBetweenSprints, resolveDropTarget, findSprintIdForTask } from '@/lib/transform';
import type { BoardState } from '@/lib/types';
import * as api from '@/lib/api';

export function useTaskMutations(
  boardState: BoardState | null,
  onBoardUpdate: () => void
) {
  const [saving, setSaving] = useState(false);

  const moveTask = async (taskId: string, targetSprintId: string): Promise<BoardState | null> => {
    if (!boardState) return null;

    // Don't move if same sprint
    const sourceSprintId = findSprintIdForTask(boardState, taskId);
    if (!sourceSprintId || sourceSprintId === targetSprintId) return null;

    // Optimistic update
    const optimisticState = moveTaskBetweenSprints(boardState, taskId, targetSprintId);

    try {
      setSaving(true);
      await api.updateTask({ id: taskId, sprintId: targetSprintId });
      onBoardUpdate(); // re-fetch to sync
    } catch {
      onBoardUpdate(); // re-fetch on error to revert optimistic update
    } finally {
      setSaving(false);
    }

    return optimisticState;
  };

  const createTask = async (sprintId: string, title: string) => {
    try {
      setSaving(true);
      await api.createTask({ sprintId, title });
      onBoardUpdate();
    } catch {
      // Could add error toast here
    } finally {
      setSaving(false);
    }
  };

  const saveTask = async (task: Task) => {
    const updates: UpdateTaskInput = {
      id: task.id,
      title: task.title,
      description: task.description,
      estimate: task.estimate,
      color: task.color,
      isCritical: task.isCritical,
    };
    try {
      setSaving(true);
      await api.updateTask(updates);
      onBoardUpdate();
    } catch {
      onBoardUpdate();
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      setSaving(true);
      await api.deleteTask(id);
      onBoardUpdate();
    } catch {
      onBoardUpdate();
    } finally {
      setSaving(false);
    }
  };

  const resolveDrop = (overId: string | number): string | undefined => {
    if (!boardState) return undefined;
    return resolveDropTarget(boardState, overId);
  };

  return { saving, moveTask, createTask, saveTask, deleteTask, resolveDrop };
}