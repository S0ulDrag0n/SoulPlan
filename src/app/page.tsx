'use client';

import { useState, useCallback } from 'react';
import { DndContext, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import ReleaseBlock from '@/components/ReleaseBlock';
import TaskCard from '@/components/TaskCard';
import EditTaskModal from '@/components/EditTaskModal';
import { useBoard } from '@/hooks/useBoard';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { moveTaskBetweenSprints, findTaskById, resolveDropTarget } from '@/lib/transform';
import type { Task } from '@/lib/types';
import * as api from '@/lib/api';

export default function Home() {
  const { boardState, loading, error, reload } = useBoard();
  const { saving, moveTask, createTask, saveTask, deleteTask } = useTaskMutations(boardState, reload);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ─── DnD handlers ─────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!boardState) return;
    const task = findTaskById(boardState, String(event.active.id));
    setActiveTask(task ?? null);
  }, [boardState]);

  const handleDragEnd = useCallback(async (event: DragStartEvent & { over: { id: string | number } | null }) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !boardState) return;

    const taskId = String(active.id);
    const targetSprintId = resolveDropTarget(boardState, over.id);
    if (!targetSprintId) return;

    await moveTask(taskId, targetSprintId);
  }, [boardState, moveTask]);

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
                onAddTask={handleAddTask}
                onEditTask={setEditingTask}
                onDeleteTask={handleDeleteTask}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Edit Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onSave={handleSaveTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}