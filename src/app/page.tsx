'use client';

import { useState, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import ReleaseBlock from '@/components/ReleaseBlock';
import EditTaskModal from '@/components/EditTaskModal';
import EditReleaseModal from '@/components/EditReleaseModal';
import EditSprintModal from '@/components/EditSprintModal';
import { useBoard } from '@/hooks/useBoard';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { moveTaskBetweenSprints, findTaskById, resolveDropTarget } from '@/lib/transform';
import type { Task, Release, Sprint } from '@/lib/types';
import * as api from '@/lib/api';

export default function Home() {
  const { boardState, loading, error, reload } = useBoard();
  const { saving, moveTask, createTask, saveTask, deleteTask, reorderTasks } = useTaskMutations(boardState, reload);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ─── DnD handlers ─────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!boardState) return;
    const task = findTaskById(boardState, String(event.active.id));
    setActiveTask(task ?? null);
  }, [boardState]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !boardState) return;

    const taskId = String(active.id);

    // Find which sprint the over target belongs to
    const targetSprintId = resolveDropTarget(boardState, over.id);
    if (!targetSprintId) return;

    const activeSprintId = findTaskById(boardState, taskId)?.sprintId;

    if (activeSprintId === targetSprintId) {
      // Same sprint — reorder
      const sprint = boardState.releases
        .flatMap(r => r.sprints)
        .find(s => s.id === targetSprintId);
      if (!sprint) return;

      const oldIndex = sprint.tasks.findIndex(t => t.id === taskId);
      if (oldIndex === -1) return;

      const overId = String(over.id);
      const newIndex = sprint.tasks.findIndex(t => t.id === overId);

      if (newIndex === -1) {
        // Dropped on the sprint column itself — move to end
        const positionUpdates = sprint.tasks
          .filter(t => t.id !== taskId)
          .map((t, i) => ({ id: t.id, position: i }));
        positionUpdates.push({ id: taskId, position: sprint.tasks.length - 1 });
        await reorderTasks(positionUpdates);
        return;
      }

      if (oldIndex === newIndex) return;

      const reordered = arrayMove(sprint.tasks, oldIndex, newIndex);
      const positionUpdates = reordered.map((t, i) => ({
        id: t.id,
        position: i,
      }));
      await reorderTasks(positionUpdates);
      return;
    }

    // Move between sprints
    await moveTask(taskId, targetSprintId);
  }, [boardState, moveTask, reorderTasks]);

  // ─── Jump to task (for dependency badges) ────────────────

  const handleJumpToTask = useCallback((taskId: string) => {
    if (!boardState) return;
    const task = findTaskById(boardState, taskId);
    if (task) setEditingTask(task);
  }, [boardState]);

  // ─── CRUD handlers ────────────────────────────────────────

  const handleAddRelease = useCallback(async () => {
    if (!boardState) return;
    await api.createRelease({ boardId: boardState.board.id, name: `Release ${boardState.releases.length + 1}` });
    reload();
  }, [boardState, reload]);

  const handleAddSprint = useCallback(async (releaseId: string) => {
    const release = boardState?.releases.find(r => r.id === releaseId);
    await api.createSprint({ releaseId, name: `Sprint ${(release?.sprints.length ?? 0) + 1}` });
    reload();
  }, [boardState, reload]);

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
          onClose={() => setEditingSprint(null)}
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