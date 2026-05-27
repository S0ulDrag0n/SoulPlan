'use client';

import { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import ReleaseBlock from '@/components/ReleaseBlock';
import TaskCard from '@/components/TaskCard';
import type { BoardState, Task } from '@/lib/types';

export default function Home() {
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchBoard = useCallback(async () => {
    const res = await fetch('/api/board');
    const data = await res.json();
    setBoardState(data);
  }, []);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  // ─── DnD handlers ─────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // Find the task from the board state
    for (const release of boardState?.releases ?? []) {
      for (const sprint of release.sprints) {
        const task = sprint.tasks.find(t => t.id === active.id);
        if (task) { setActiveTask(task); return; }
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find the task being dragged
    let taskId: string | null = null;
    let sourceSprintId: string | null = null;

    for (const release of boardState?.releases ?? []) {
      for (const sprint of release.sprints) {
        const task = sprint.tasks.find(t => t.id === active.id);
        if (task) {
          taskId = task.id;
          sourceSprintId = task.sprint_id;
          break;
        }
      }
      if (taskId) break;
    }

    if (!taskId) return;

    // over.id is either a sprint id or a task id
    // Determine target sprint
    let targetSprintId: string | null = null;
    for (const release of boardState?.releases ?? []) {
      for (const sprint of release.sprints) {
        if (sprint.id === over.id) {
          targetSprintId = sprint.id;
          break;
        }
        const task = sprint.tasks.find(t => t.id === over.id);
        if (task) {
          targetSprintId = task.sprint_id;
          break;
        }
      }
      if (targetSprintId) break;
    }

    if (!targetSprintId || targetSprintId === sourceSprintId) return;

    // Optimistic update
    setBoardState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        releases: prev.releases.map(r => ({
          ...r,
          sprints: r.sprints.map(s => ({
            ...s,
            tasks: s.id === targetSprintId
              ? [...s.tasks, ...(s.id === sourceSprintId ? s.tasks.filter(t => t.id !== taskId) : s.tasks), { ...s.tasks.find(t => t.id === taskId)!, sprint_id: targetSprintId }]
              : s.id === sourceSprintId
                ? s.tasks.filter(t => t.id !== taskId)
                : s.tasks,
          })),
        })),
      };
    });

    // Persist
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, sprint_id: targetSprintId }),
    });
    // Re-fetch to sync
    fetchBoard();
  };

  // ─── CRUD handlers ────────────────────────────────────────
  const addRelease = async () => {
    if (!boardState) return;
    await fetch('/api/releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId: boardState.board.id, name: `Release ${boardState.releases.length + 1}` }),
    });
    fetchBoard();
  };

  const addSprint = async (releaseId: string) => {
    const release = boardState?.releases.find(r => r.id === releaseId);
    await fetch('/api/sprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ releaseId, name: `Sprint ${(release?.sprints.length ?? 0) + 1}` }),
    });
    fetchBoard();
  };

  const addTask = async (sprintId: string) => {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId, title: 'New Task' }),
    });
    fetchBoard();
  };

  const saveTask = async (task: Task) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task }),
    });
    setEditingTask(null);
    fetchBoard();
  };

  const deleteTask = async (id: string) => {
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchBoard();
  };

  if (!boardState) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{boardState.board.name}</h1>
        <button
          onClick={addRelease}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          + Add Release
        </button>
      </header>

      {/* Board */}
      <main className="p-6 overflow-x-auto">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 min-h-[400px]">
            {boardState.releases.map((release) => (
              <ReleaseBlock
                key={release.id}
                release={release}
                onAddSprint={addSprint}
                onAddTask={addTask}
                onEditTask={setEditingTask}
                onDeleteTask={deleteTask}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditingTask(null)}>
          <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Edit Task</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Title</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Estimate (points)</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={editingTask.estimate}
                  onChange={(e) => setEditingTask({ ...editingTask, estimate: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Color</label>
                <input
                  type="color"
                  className="w-full h-10 rounded mt-1"
                  value={editingTask.color}
                  onChange={(e) => setEditingTask({ ...editingTask, color: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editingTask.is_critical}
                  onChange={(e) => setEditingTask({ ...editingTask, is_critical: e.target.checked ? 1 : 0 })}
                />
                <label className="text-sm text-gray-600">Critical</label>
              </div>
              <div>
                <label className="text-sm text-gray-600">Description</label>
                <textarea
                  className="w-full border rounded px-3 py-2 mt-1"
                  rows={3}
                  value={editingTask.description ?? ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setEditingTask(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => saveTask(editingTask)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}