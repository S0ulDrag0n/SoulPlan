'use client';

import { useState, useRef } from 'react';
import type { Task, UpdateTaskInput, BoardState } from '@/lib/types';
import { moveTaskBetweenSprints, findSprintIdForTask } from '@/lib/transform';
import * as api from '@/lib/api';

export function useTaskMutations(
  boardState: BoardState | null,
  onBoardUpdate: () => void,
  setBoardState: (state: BoardState) => void
) {
  const [saving, setSaving] = useState(false);

  // Ref to always-read-latest boardState in async handlers
  const boardStateRef = useRef(boardState);
  boardStateRef.current = boardState;

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
        });
      }

      // Update positions for all tasks in target sprint sequentially
      // (prevents race conditions where out-of-order PATCHes clobber positions)
      for (const t of targetSprint.tasks) {
        await api.updateTask({ id: t.id, position: t.position });
      }

      // Re-index source sprint if cross-sprint move
      if (sourceSprintId !== targetSprintId) {
        const sourceSprint = optimisticState.releases
          .flatMap(r => r.sprints)
          .find(s => s.id === sourceSprintId);
        if (sourceSprint) {
          for (const t of sourceSprint.tasks) {
            await api.updateTask({ id: t.id, position: t.position });
          }
        }
      }

      onBoardUpdate();
    } catch {
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
      // Send position updates sequentially to prevent race conditions
      for (const u of positionUpdates) {
        await api.updateTask({ id: u.id, position: u.position });
      }
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

  return { saving, moveTask, reorderTasks, createTask, saveTask, deleteTask };
}