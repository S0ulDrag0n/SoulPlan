'use client';

import { useState, useRef, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import ReleaseBlock from '@/components/ReleaseBlock';
import EditTaskModal from '@/components/EditTaskModal';
import EditReleaseModal from '@/components/EditReleaseModal';
import EditSprintModal from '@/components/EditSprintModal';
import { useBoard } from '@/hooks/useBoard';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { findTaskById, resolveDropTarget } from '@/lib/transform';
import type { Task, Release, Sprint } from '@/lib/types';
import * as api from '@/lib/api';

export default function Home() {
  const { boardState, setBoardState, loading, error, reload } = useBoard();
  const { saving, error: mutationError, moveTask, createTask, saveTask, deleteTask, reorderTasks } = useTaskMutations(boardState, reload, setBoardState);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  // Ref to always-read-latest boardState in async DnD handlers
  const boardStateRef = useRef(boardState);
  boardStateRef.current = boardState;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ─── DnD handlers ─────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const state = boardStateRef.current;
    if (!state) return;
    const task = findTaskById(state, String(event.active.id));
    setActiveTask(task ?? null);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    const state = boardStateRef.current;
    if (!over || !state) return;

    const taskId = String(active.id);

    // resolveDropTarget returns { sprintId, insertIndex }
    const drop = resolveDropTarget(state, over.id);
    if (!drop) return;

    const { sprintId: targetSprintId, insertIndex } = drop;
    const activeSprintId = findTaskById(state, taskId)?.sprintId;

    if (activeSprintId === targetSprintId) {
      // Same sprint — reorder within
      const sprint = state.releases
        .flatMap(r => r.sprints)
        .find(s => s.id === targetSprintId);
      if (!sprint) return;

      const oldIndex = sprint.tasks.findIndex(t => t.id === taskId);
      if (oldIndex === -1) return;

      // If dropped on same position, no-op
      if (oldIndex === insertIndex || (insertIndex === sprint.tasks.length && oldIndex === sprint.tasks.length - 1)) return;

      // Use arrayMove for same-sprint reorder
      const reordered = arrayMove(sprint.tasks, oldIndex, insertIndex);
      const positionUpdates = reordered.map((t, i) => ({
        id: t.id,
        position: i,
      }));
      await reorderTasks(positionUpdates, targetSprintId);
      return;
    }

    // Cross-sprint move — pass insertIndex so task lands at the right position
    await moveTask(taskId, targetSprintId, insertIndex);
  }, [moveTask, reorderTasks]);

  // ─── Jump to task (for dependency badges) ────────────────

  const handleJumpToTask = useCallback((taskId: string) => {
    const state = boardStateRef.current;
    if (!state) return;
    const task = findTaskById(state, taskId);
    if (task) setEditingTask(task);
  }, []);

  // ─── CRUD handlers ────────────────────────────────────────

  const handleAddRelease = useCallback(async () => {
    const state = boardStateRef.current;
    if (!state) return;
    await api.createRelease({ boardId: state.board.id, name: `Release ${state.releases.length + 1}` });
    reload();
  }, [reload]);

  const handleAddSprint = useCallback(async (releaseId: string) => {
    const state = boardStateRef.current;
    const release = state?.releases.find(r => r.id === releaseId);
    await api.createSprint({ releaseId, name: `Sprint ${(release?.sprints.length ?? 0) + 1}` });
    reload();
  }, [reload]);

  const handleAddTask = useCallback(async (sprintId: string) => {
    await createTask(sprintId, 'New Task');
  }, [createTask]);

  const handleSaveTask = useCallback(async (task: Task) => {
    await saveTask(task);
    setEditingTask(null);
  }, [saveTask]);

  const handleDeleteTask = useCallback(async (id: string) => {
    await deleteTask(id);
  }, [deleteTask]);

  const handleEditRelease = useCallback(async (id: string, data: { name?: string; targetDate?: string | null; notes?: string | null }) => {
    await api.updateRelease(id, data);
    setEditingRelease(null);
    reload();
  }, [reload]);

  const handleDeleteRelease = useCallback(async (id: string) => {
    if (!confirm('Delete this release and all its sprints and tasks?')) return;
    await api.deleteRelease(id);
    reload();
  }, [reload]);

  const handleEditSprint = useCallback(async (id: string, data: {
    name?: string; capacity?: number; capacityUnit?: string;
    startDate?: string | null; endDate?: string | null; notes?: string | null;
  }) => {
    await api.updateSprint(id, data);
    setEditingSprint(null);
    reload();
  }, [reload]);

  const handleDeleteSprint = useCallback(async (id: string) => {
    if (!confirm('Delete this sprint and all its tasks?')) return;
    await api.deleteSprint(id);
    reload();
  }, [reload]);

  // ─── Render ───────────────────────────────────────────────

  if (loading && !boardState) {
    return <div className="p-8 text-gray-500">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-600 font-medium">Error: {error}</div>
        <button onClick={reload} className="mt-2 text-blue-600 hover:underline">Retry</button>
      </div>
    );
  }

  if (!boardState) return null;

  const allDependencies = boardState.dependencies;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mutation error toast */}
      {mutationError && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse">
          {mutationError}
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{boardState.board.name}</h1>
        <div className="flex items-center gap-3">
          {saving && <span className="text-sm text-gray-400">Saving...</span>}
          <button
            onClick={handleAddRelease}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + Add Release
          </button>
        </div>
      </header>

      {/* Board */}
      <main className="p-6 overflow-x-auto">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 min-h-[400px]">
            {boardState.releases.map((release) => (
              <ReleaseBlock
                key={release.id}
                release={release}
                onAddSprint={handleAddSprint}
                onEditRelease={setEditingRelease}
                onDeleteRelease={handleDeleteRelease}
                onAddTask={handleAddTask}
                onEditTask={setEditingTask}
                onDeleteTask={handleDeleteTask}
                onEditSprint={setEditingSprint}
                onDeleteSprint={handleDeleteSprint}
                dependencies={allDependencies}
                onJumpToTask={handleJumpToTask}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? <DragOverlayTask task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Modals */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          boardState={boardState}
          onSave={handleSaveTask}
          onClose={() => setEditingTask(null)}
        />
      )}
      {editingRelease && (
        <EditReleaseModal
          release={editingRelease}
          onSave={handleEditRelease}
          onClose={() => setEditingRelease(null)}
        />
      )}
      {editingSprint && (
        <EditSprintModal
          sprint={editingSprint}
          onSave={handleEditSprint}
          onClose={() =>setEditingSprint(null)}
        />
      )}
    </div>
  );
}

/** Lightweight task card for the drag overlay (no sortable hooks) */
function DragOverlayTask({ task }: { task: Task }) {
  return (
    <div
      className="bg-white rounded-lg shadow-lg p-3 border-l-4"
      style={{ borderLeftColor: task.color }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800">{task.title}</span>
        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {task.estimate > 0 ? `${task.estimate}pt` : '—'}
        </span>
      </div>
    </div>
  );
}