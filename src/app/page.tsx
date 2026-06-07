'use client';

import { useState, useRef, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import ReleaseBlock from '@/components/ReleaseBlock';
import EditTaskModal from '@/components/EditTaskModal';
import EditReleaseModal from '@/components/EditReleaseModal';
import EditSprintModal from '@/components/EditSprintModal';
import DependencyLines from '@/components/DependencyLines';
import { DependencyConnectorProvider } from '@/components/DependencyConnector';
import StickyNote from '@/components/StickyNote';
import NoteConnectionLines from '@/components/NoteConnectionLines';
import { NoteConnectorProvider, useNoteConnector } from '@/components/NoteConnector';
import PanCanvas from '@/components/PanCanvas';
import ThemeToggle from '@/components/ThemeToggle';
import { useBoard } from '@/hooks/useBoard';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { findTaskById, resolveDropTarget } from '@/lib/transform';
import type { Task, Release, Sprint, StickyNote as StickyNoteModel, NoteConnectionTargetType } from '@/lib/types';
import * as api from '@/lib/api';

const STICKY_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'] as const;
type StickyColor = (typeof STICKY_COLORS)[number];

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

  // Ref for the scrollable board container (for dependency lines)
  const boardContainerRef = useRef<HTMLDivElement>(null);

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

  // Re-draw dependency lines after drag operations settle
  const handleDragEndAndRefresh = useCallback(async (event: DragEndEvent) => {
    await handleDragEnd(event);
    // Lines will update via ResizeObserver and boardState change,
    // but add a small delay for DOM to settle after drag
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }, [handleDragEnd]);

  // ─── Dependency creation / deletion ────────────────────────

  const handleCreateDependency = useCallback(async (fromTaskId: string, toTaskId: string) => {
    try {
      await api.createDependency(fromTaskId, toTaskId);
    } catch (err) {
      console.error('Failed to create dependency:', err);
    }
    reload();
  }, [reload]);

  const handleDeleteDependency = useCallback(async (depId: string) => {
    try {
      await api.deleteDependency(depId);
    } catch (err) {
      console.error('Failed to delete dependency:', err);
    }
    reload();
  }, [reload]);

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

  const handleDeleteTask = useCallback(async (id: string) => void deleteTask(id), [deleteTask]);

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

  // ─── Sticky note handlers ─────────────────────────────────

  const handleAddSticky = useCallback(async () => {
    const state = boardStateRef.current;
    if (!state) return;
    // Place new note at a default position; queries.findFreeNotePosition
    // will bump it if there's a collision.
    await api.createStickyNote({
      boardId: state.board.id,
      x: 400,
      y: 50,
      color: 'yellow',
    });
    reload();
  }, [reload]);

  const handleMoveSticky = useCallback(async (id: string, x: number, y: number) => {
    // Optimistic update
    setBoardState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stickyNotes: prev.stickyNotes.map((n) =>
          n.id === id ? { ...n, x, y } : n
        ),
      };
    });
    try {
      await api.updateStickyNote(id, { x, y });
    } catch (err) {
      console.error('Failed to move sticky note:', err);
      reload();
    }
  }, [reload, setBoardState]);

  const handleTextChangeSticky = useCallback(async (id: string, text: string) => {
    setBoardState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stickyNotes: prev.stickyNotes.map((n) =>
          n.id === id ? { ...n, text } : n
        ),
      };
    });
    try {
      await api.updateStickyNote(id, { text });
    } catch (err) {
      console.error('Failed to update sticky note text:', err);
      reload();
    }
  }, [reload, setBoardState]);

  const handleDeleteSticky = useCallback(async (id: string) => {
    // Optimistic
    setBoardState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stickyNotes: prev.stickyNotes.filter((n) => n.id !== id),
        noteConnections: prev.noteConnections.filter((c) => c.noteId !== id),
      };
    });
    try {
      await api.deleteStickyNote(id);
    } catch (err) {
      console.error('Failed to delete sticky note:', err);
      reload();
    }
  }, [reload, setBoardState]);

  const handleColorCycleSticky = useCallback(async (id: string) => {
    const state = boardStateRef.current;
    if (!state) return;
    const note = state.stickyNotes.find((n) => n.id === id);
    if (!note) return;
    const idx = STICKY_COLORS.indexOf(note.color as StickyColor);
    const nextColor = STICKY_COLORS[(idx + 1) % STICKY_COLORS.length];
    setBoardState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stickyNotes: prev.stickyNotes.map((n) =>
          n.id === id ? { ...n, color: nextColor } : n
        ),
      };
    });
    try {
      await api.updateStickyNote(id, { color: nextColor });
    } catch (err) {
      console.error('Failed to update sticky note color:', err);
      reload();
    }
  }, [reload, setBoardState]);

  // ─── Note connection handlers ─────────────────────────────

  const handleCreateNoteConnection = useCallback(
    async (noteId: string, toType: NoteConnectionTargetType, toId: string) => {
      try {
        await api.createNoteConnection({ noteId, toType, toId });
      } catch (err) {
        console.error('Failed to create note connection:', err);
      }
      reload();
    },
    [reload]
  );

  const handleDeleteNoteConnection = useCallback(async (id: string) => {
    setBoardState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        noteConnections: prev.noteConnections.filter((c) => c.id !== id),
      };
    });
    try {
      await api.deleteNoteConnection(id);
    } catch (err) {
      console.error('Failed to delete note connection:', err);
      reload();
    }
  }, [reload, setBoardState]);

  // ─── Render ───────────────────────────────────────────────

  if (loading && !boardState) {
    return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-600 dark:text-red-400 font-medium">Error: {error}</div>
        <button onClick={reload} className="mt-2 text-blue-600 dark:text-blue-400 hover:underline">Retry</button>
      </div>
    );
  }

  if (!boardState) return null;

  const allDependencies = boardState.dependencies;
  const allStickyNotes = boardState.stickyNotes;
  const allNoteConnections = boardState.noteConnections;

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors">
      {/* Mutation error toast */}
      {mutationError ? (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse">
          {mutationError}
        </div>
      ) : null}
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{boardState.board.name}</h1>
        <div className="flex items-center gap-3">
          {saving ? <span className="text-sm text-gray-400 dark:text-gray-500">Saving...</span> : null}
          <ThemeToggle />
          <button
            onClick={handleAddSticky}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600 transition-colors text-sm font-medium"
            title="Add a sticky note anywhere on the board"
          >
            + Sticky
          </button>
          <button
            onClick={handleAddRelease}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            + Add Release
          </button>
        </div>
      </header>

      {/* Board — Miro-style pannable canvas with dependency + note connectors */}
      <NoteConnectorProvider
        noteConnections={allNoteConnections}
        onCreateConnection={handleCreateNoteConnection}
      >
        <DependencyConnectorProvider
          dependencies={allDependencies}
          onCreateDependency={handleCreateDependency}
          containerRef={boardContainerRef}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEndAndRefresh}
          >
            <PanCanvas className="flex-1">
              <div ref={boardContainerRef} className="relative p-8">
                <div className="relative flex gap-6 min-h-[400px]">
                  <DependencyLines
                    dependencies={allDependencies}
                    containerRef={boardContainerRef}
                    onDeleteDependency={handleDeleteDependency}
                  />
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

                {/* Note connection lines — share the boardContainerRef so
                    selectors find both sticky notes and target cards. */}
                <NoteConnectionLines
                  connections={allNoteConnections}
                  containerRef={boardContainerRef}
                  onDelete={handleDeleteNoteConnection}
                />

                {/* Sticky notes layer — sibling of the releases row, inside
                    the same container so they pan together and share coords. */}
                <NoteLayer
                  notes={allStickyNotes}
                  onMove={handleMoveSticky}
                  onTextChange={handleTextChangeSticky}
                  onDelete={handleDeleteSticky}
                  onColorCycle={handleColorCycleSticky}
                />
              </div>
            </PanCanvas>

            {/* DragOverlay outside PanCanvas so it's not affected by pan transform */}
            <DragOverlay>
              {activeTask ? <DragOverlayTask task={activeTask} /> : null}
            </DragOverlay>
          </DndContext>
        </DependencyConnectorProvider>
      </NoteConnectorProvider>

      {/* Modals */}
      {editingTask ? (
        <EditTaskModal
          task={editingTask}
          boardState={boardState}
          onSave={handleSaveTask}
          onClose={() => setEditingTask(null)}
        />
      ) : null}
      {editingRelease ? (
        <EditReleaseModal
          release={editingRelease}
          onSave={handleEditRelease}
          onClose={() => setEditingRelease(null)}
        />
      ) : null}
      {editingSprint ? (
        <EditSprintModal
          sprint={editingSprint}
          onSave={handleEditSprint}
          onClose={() => setEditingSprint(null)}
        />
      ) : null}
    </div>
  );
}

/** Renders sticky notes and wires the connector handle to the provider. */
function NoteLayer({
  notes,
  onMove,
  onTextChange,
  onDelete,
  onColorCycle,
}: {
  notes: StickyNoteModel[];
  onMove: (id: string, x: number, y: number) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onColorCycle: (id: string) => void;
}) {
  const { startConnection } = useNoteConnector();
  return (
    <>
      {notes.map((note) => (
        <StickyNote
          key={note.id}
          note={note}
          onMove={onMove}
          onTextChange={onTextChange}
          onDelete={onDelete}
          onColorCycle={onColorCycle}
          onConnectionDragStart={startConnection}
        />
      ))}
    </>
  );
}

/** Lightweight task card for the drag overlay (no sortable hooks) */
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
