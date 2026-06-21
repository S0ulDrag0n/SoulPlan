'use client';

import { useState, useRef } from 'react';
import type { Task, UpdateTaskInput, BoardState } from '@/lib/types';
import { moveTaskBetweenSprints, findSprintIdForTask } from '@/lib/transform';
import * as api from '@/lib/api';

export function useTaskMutations(
  boardState: BoardState | null,
  onBoardUpdate: () => void,
  setBoardState: (state: BoardState) => void,
  projectId?: string | null,
) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to always-read-latest boardState in async handlers
  const boardStateRef = useRef(boardState);
  boardStateRef.current = boardState;

  /** Show a transient error that auto-clears after 3s */
  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 3000);
  };

  /**
   * Move a task to a different sprint (or reorder within the same sprint).
   * insertIndex: where to insert in the target sprint's task list.
   *               -1 or omitted → append to end.
   */
  const moveTask = async (taskId: string, targetSprintId: string, insertIndex: number = -1): Promise<void> => {
    const state = boardStateRef.current;
    if (!state) return;

    const sourceSprintId = findSprintIdForTask(state, taskId);
    if (!sourceSprintId) return;

    // Optimistic update — apply immediately so UI doesn't rubber-band
    const optimisticState = moveTaskBetweenSprints(state, taskId, targetSprintId, insertIndex);
    setBoardState(optimisticState);

    // Build position updates for all affected tasks
    const targetSprint = optimisticState.releases
      .flatMap(r => r.sprints)
      .find(s => s.id === targetSprintId);

    if (!targetSprint) { onBoardUpdate(); return; }

    try {
      setSaving(true);

      // Update the moved task's sprintId + position FIRST (sequential to avoid race)
      if (sourceSprintId !== targetSprintId) {
        const movedTask = targetSprint.tasks.find(t => t.id === taskId);
        await api.updateTask({
          id: taskId,
          sprintId: targetSprintId,
          position: movedTask?.position ?? 0,
        }, projectId ?? undefined);
      }

      // Update positions for all tasks in target sprint sequentially
      for (const t of targetSprint.tasks) {
        await api.updateTask({ id: t.id, position: t.position }, projectId ?? undefined);
      }

      // Re-index source sprint if cross-sprint move
      if (sourceSprintId !== targetSprintId) {
        const sourceSprint = optimisticState.releases
          .flatMap(r => r.sprints)
          .find(s => s.id === sourceSprintId);
        if (sourceSprint) {
          for (const t of sourceSprint.tasks) {
            await api.updateTask({ id: t.id, position: t.position }, projectId ?? undefined);
          }
        }
      }

      onBoardUpdate();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to move task');
      onBoardUpdate(); // re-fetch on error to revert optimistic update
    } finally {
      setSaving(false);
    }
  };

  /** Reorder tasks within a sprint by sending position updates */
  const reorderTasks = async (positionUpdates: { id: string; position: number }[], sprintId: string) => {
    const state = boardStateRef.current;
    if (!state) return;

    // Optimistic reorder — apply immediately for smooth UX
    const sprint = state.releases
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
      ...state,
      releases: state.releases.map(r => ({
        ...r,
        sprints: r.sprints.map(s =>
          s.id === sprintId ? { ...s, tasks: reorderedTasks } : s
        ),
      })),
    };
    setBoardState(optimisticState);

    try {
      setSaving(true);
      for (const u of positionUpdates) {
        await api.updateTask({ id: u.id, position: u.position }, projectId ?? undefined);
      }
      onBoardUpdate();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to reorder tasks');
      onBoardUpdate(); // revert on error
    } finally {
      setSaving(false);
    }
  };

  const createTask = async (sprintId: string, title: string) => {
    try {
      setSaving(true);
      await api.createTask({ sprintId, title }, projectId ?? undefined);
      onBoardUpdate();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create task');
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
      await api.updateTask(updates, projectId ?? undefined);
      onBoardUpdate();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save task');
      onBoardUpdate();
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      setSaving(true);
      await api.deleteTask(id, projectId ?? undefined);
      onBoardUpdate();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete task');
      onBoardUpdate();
    } finally {
      setSaving(false);
    }
  };

  return { saving, error, moveTask, reorderTasks, createTask, saveTask, deleteTask };
}