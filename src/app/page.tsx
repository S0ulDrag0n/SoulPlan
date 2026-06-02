'use client';

import { useState, useRef, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useBoard } from '@/hooks/useBoard';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import ReleaseBlock from '@/components/ReleaseBlock';
import SprintColumn from '@/components/SprintColumn';
import SortableTaskCard from '@/components/SortableTaskCard';
import EditReleaseModal from '@/components/EditReleaseModal';
import EditSprintModal from '@/components/EditSprintModal';
import EditTaskModal from '@/components/EditTaskModal';
import DependencyLines from '@/components/DependencyLines';
import PanCanvas from '@/components/PanCanvas';
import ThemeToggle from '@/components/ThemeToggle';
import { findTaskById, resolveDropTarget } from '@/lib/transform';
import { reorderTasks, moveTask } from '@/lib/api';
import type { Task } from '@/lib/types';

function DragOverlayTask({ task }: { task: Task }) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border-l-4"
      style={{ borderLeftColor: task.color }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{task.title}</span>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
          {task.estimate > 0 ? `${task.estimate}pt` : '—'}
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const { boardState, setBoardState, saving, mutationError } = useBoard();
  const { addTaskMutation, updateTaskMutation, deleteTaskMutation } = useTaskMutations();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingRelease, setEditingRelease] = useState<typeof boardState.releases[0] | null>(null);
  const [editingSprint, setEditingSprint] = useState<typeof boardState.sprints[0] | null>(null);
  const [addingTaskToSprint, setAddingTaskToSprint] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const boardContainerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = findTaskById(boardState, String(active.id));
    if (task) setActiveTask(task);
  };

  const handleDragEndAndRefresh = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTask = findTaskById(boardState, String(active.id));
    if (!activeTask) return;

    const target = resolveDropTarget(boardState, over.id.toString());
    if (!target) return;

    const { sprintId: targetSprintId, index: insertIndex } = target;

    if (activeTask.sprintId === targetSprintId) {
      // Reorder within same sprint
      const sprint = boardState.sprints.find(s => s.id === targetSprintId);
      if (!sprint) return;
      const oldIndex = sprint.tasks.findIndex(t => t.id === activeTask.id);
      if (oldIndex === -1) return;
      const newIndex = insertIndex ?? sprint.tasks.length;
      const reordered = Array.from(sprint.tasks);
      const [moved] = reordered.splice(oldIndex, 1);
      const adjustedIndex = newIndex > oldIndex ? newIndex - 1 : newIndex;
      reordered.splice(adjustedIndex, 0, moved);

      setBoardState(prev => ({
        ...prev,
        sprints: prev.sprints.map(s =>
          s.id === targetSprintId ? { ...s, tasks: reordered } : s
        ),
      }));

      try {
        await reorderTasks(targetSprintId, reordered.map(t => t.id));
      } catch (err) {
        // Optimistic — will sync on next fetch
      }
    } else {
      // Move between sprints
      const targetSprint = boardState.sprints.find(s => s.id === targetSprintId);
      const insertIndexFinal = insertIndex ?? (targetSprint?.tasks.length ?? 0);

      setBoardState(prev => {
        const sourceSprint = prev.sprints.find(s => s.id === activeTask.sprintId);
        const destSprint = prev.sprints.find(s => s.id === targetSprintId);
        if (!sourceSprint || !destSprint) return prev;

        const updatedSourceTasks = sourceSprint.tasks.filter(t => t.id !== activeTask.id);

        const destTasks = [...destSprint.tasks];
        destTasks.splice(insertIndexFinal, 0, { ...activeTask, sprintId: targetSprintId });

        return {
          ...prev,
          sprints: prev.sprints.map(s => {
            if (s.id === sourceSprint.id) return { ...s, tasks: updatedSourceTasks };
            if (s.id === destSprint.id) return { ...s, tasks: destTasks };
            return s;
          }),
        };
      });

      try {
        await moveTask(activeTask.id, targetSprintId, insertIndexFinal);
      } catch (err) {
        // Optimistic — will sync on next fetch
      }
    }

    // Refresh dependency lines after drag
    setTimeout(() => {
      window.dispatchEvent(new Event('pointerup'));
    }, 50);
  };

  const handleAddRelease = async () => {
    try {
      const res = await fetch('/api/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: boardState.board.id }),
      });
      if (!res.ok) throw new Error('Failed to add release');
      setBoardState(prev => ({ ...prev, _refresh: Date.now() }));
    } catch (err) {
      console.error('Failed to add release:', err);
    }
  };

  const handleAddSprint = async (releaseId: string) => {
    try {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId, name: 'New Sprint' }),
      });
      if (!res.ok) throw new Error('Failed to add sprint');
      setBoardState(prev => ({ ...prev, _refresh: Date.now() }));
    } catch (err) {
      console.error('Failed to add sprint:', err);
    }
  };

  const handleDeleteRelease = async (id: string) => {
    if (!confirm('Delete this release and all its sprints/tasks?')) return;
    try {
      const res = await fetch(`/api/releases/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete release');
      setBoardState(prev => ({ ...prev, _refresh: Date.now() }));
    } catch (err) {
      console.error('Failed to delete release:', err);
    }
  };

  const handleDeleteSprint = async (id: string) => {
    if (!confirm('Delete this sprint and all its tasks?')) return;
    try {
      const res = await fetch(`/api/sprints/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete sprint');
      setBoardState(prev => ({ ...prev, _refresh: Date.now() }));
    } catch (err) {
      console.error('Failed to delete sprint:', err);
    }
  };

  const handleAddTask = (sprintId: string) => setAddingTaskToSprint(sprintId);

  const handleEditRelease = (release: typeof boardState.releases[0]) => setEditingRelease(release);
  const handleEditSprint = (sprint: typeof boardState.sprints[0]) => setEditingSprint(sprint);

  const handleJumpToTask = (taskId: string) => {
    const el = document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Auto-create task
  const handleTaskCreated = async (sprintId: string, title: string) => {
    setAddingTaskToSprint(null);
    try {
      await addTaskMutation({ sprintId, title, estimate: 0, color: '#6366f1' });
      setBoardState(prev => ({ ...prev, _refresh: Date.now() }));
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleSaveTask = async (task: Task) => {
    setEditingTask(null);
    try {
      await updateTaskMutation(task);
      setBoardState(prev => ({ ...prev, _refresh: Date.now() }));
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTaskMutation(id);
      setBoardState(prev => ({ ...prev, _refresh: Date.now() }));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleSaveRelease = async (id: string, data: { name?: string; targetDate?: string | null; notes?: string | null }) => {
    setEditingRelease(null);
    try {
      const res = await fetch(`/api/releases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save release');
      setBoardState(prev => ({ ...prev, _refresh: Date.now() }));
    } catch (err) {
      console.error('Failed to save release:', err);
    }
  };

  const handleSaveSprint = async (id: string, data: {
    name?: string; capacity?: number; capacityUnit?: string;
    startDate?: string | null; endDate?: string | null; notes?: string | null;
  }) => {
    setEditingSprint(null);
    try {
      const res = await fetch(`/api/sprints/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save sprint');
      setBoardState(prev => ({ ...prev, _refresh: Date.now() }));
    } catch (err) {
      console.error('Failed to save sprint:', err);
    }
  };

  const allDependencies = boardState.dependencies;

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors">
      {/* Mutation error toast */}
      {mutationError && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse">
          {mutationError}
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{boardState.board.name}</h1>
        <div className="flex items-center gap-3">
          {saving && <span className="text-sm text-gray-400 dark:text-gray-500">Saving...</span>}
          <ThemeToggle />
          <button
            onClick={handleAddRelease}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            + Add Release
          </button>
        </div>
      </header>

      {/* Board — Miro-style pannable canvas */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEndAndRefresh}>
        <PanCanvas className="flex-1">
          <div ref={boardContainerRef} className="relative p-8">
            <DependencyLines dependencies={allDependencies} containerRef={boardContainerRef} />

            <div className="flex gap-8">
              {boardState.releases.map(release => (
                <ReleaseBlock
                  key={release.id}
                  release={release}
                  onAddSprint={handleAddSprint}
                  onEditRelease={handleEditRelease}
                  onDeleteRelease={handleDeleteRelease}
                  onAddTask={handleAddTask}
                  onEditTask={task => setEditingTask(task)}
                  onDeleteTask={handleDeleteTask}
                  onEditSprint={handleEditSprint}
                  onDeleteSprint={handleDeleteSprint}
                  dependencies={allDependencies}
                  onJumpToTask={handleJumpToTask}
                />
              ))}
            </div>
          </div>
        </PanCanvas>

        <DragOverlay>
          {activeTask ? <DragOverlayTask task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Add Task quick-create */}
      {addingTaskToSprint && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50" onClick={() => setAddingTaskToSprint(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">New Task</h3>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Task title..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  handleTaskCreated(addingTaskToSprint, e.currentTarget.value.trim());
                }
              }}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setAddingTaskToSprint(null)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Cancel</button>
              <button onClick={() => {
                const input = document.querySelector('input[placeholder="Task title..."]') as HTMLInputElement;
                if (input?.value.trim()) handleTaskCreated(addingTaskToSprint, input.value.trim());
              }} className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modals */}
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
          onSave={handleSaveRelease}
          onClose={() => setEditingRelease(null)}
        />
      )}
      {editingSprint && (
        <EditSprintModal
          sprint={editingSprint}
          onSave={handleSaveSprint}
          onClose={() => setEditingSprint(null)}
        />
      )}
    </div>
  );
}