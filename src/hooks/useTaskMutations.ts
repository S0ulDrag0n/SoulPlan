'use client';

import { useState } from 'react';
import type { Task, UpdateTaskInput, BoardState } from '@/lib/types';
import { moveTaskBetweenSprints, resolveDropTarget, findSprintIdForTask } from '@/lib/transform';
import { arrayMove } from '@dnd-kit/sortable';
import * as api from '@/lib/api';

export function useTaskMutations(
  boardState: BoardState | null,
  onBoardUpdate: () => void,
  setBoardState: (state: BoardState) => void
) {
  const [saving, setSaving] = useState(false);

  const moveTask = async (taskId: string, targetSprintId: string): Promise<void> => {
    if (!boardState) return;

    // Don't move if same sprint
    const sourceSprintId = findSprintIdForTask(boardState, taskId);
    if (!sourceSprintId || sourceSprintId === targetSprintId) return;

    // Optimistic update — apply immediately so UI doesn't rubber-band
    const optimisticState = moveTaskBetweenSprints(boardState, taskId, targetSprintId);
    setBoardState(optimisticState);

    try {
      setSaving(true);
      await api.updateTask({ id: taskId, sprintId: targetSprintId });
      onBoardUpdate(); // re-fetch to sync with server
    } catch {
      onBoardUpdate(); // re-fetch on error to revert optimistic update
    } finally {
      setSaving(false);
    }
  };

  /** Reorder tasks within a sprint by sending position updates */
  const reorderTasks = async (positionUpdates: { id: string; position: number }[], sprintId: string) => {
    if (!boardState) return;

    // Optimistic reorder — apply immediately for smooth UX
    const sprint = boardState.releases
      .flatMap(r => r.sprints)
      .find(s => s.id === sprintId);
    if (!sprint) return;

    // Build reordered task list from position updates
    const taskMap = new Map(sprint.tasks.map(t => [t.id, t]));
    const reorderedTasks = positionUpdates
      .sort((a, b) => a.position - b.position)
      .map(u => taskMap.get(u.id))
      .filter(Boolean) as Task[];

    // Apply optimistic state
    const optimisticState: BoardState = {
      ...boardState,
      releases: boardState.releases.map(r => ({
        ...r,
        sprints: r.sprints.map(s =>
          s.id === sprintId ? { ...s, tasks: reorderedTasks } : s
        ),
      })),
    };
    setBoardState(optimisticState);

    try {
      setSaving(true);
      // Send all position updates in parallel
      await Promise.all(
        positionUpdates.map(u => api.updateTask({ id: u.id, position: u.position }))
      );
      onBoardUpdate();
    } catch {
      onBoardUpdate(); // revert on error
    } finally {
      setSaving(false);
    }
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

  return { saving, moveTask, reorderTasks, createTask, saveTask, deleteTask, resolveDrop };
}