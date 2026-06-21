'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
import AuthForm from '@/components/AuthForm';
import ProjectSwitcher from '@/components/ProjectSwitcher';
import ShareDialog from '@/components/ShareDialog';
import CursorOverlay from '@/components/CursorOverlay';
import PresenceBar from '@/components/PresenceBar';
import { useAuth } from '@/components/AuthProvider';
import { useBoard } from '@/hooks/useBoard';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { useRealtime } from '@/hooks/useRealtime';
import { findTaskById, resolveDropTarget } from '@/lib/transform';
import type { Task, Release, Sprint, StickyNote as StickyNoteModel, NoteConnectionTargetType, Project } from '@/lib/types';
import * as api from '@/lib/api';

const STICKY_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'] as const;
type StickyColor = (typeof STICKY_COLORS)[number];

export default function Home() {
  const { session, loading: authLoading } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Restore last-used project from localStorage on mount.
  useEffect(() => {
    const saved = localStorage.getItem('soulplan-selected-project');
    if (saved) setSelectedProjectId(saved);
  }, []);

  // Persist selected project whenever it changes.
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('soulplan-selected-project', selectedProjectId);
    } else {
      localStorage.removeItem('soulplan-selected-project');
    }
  }, [selectedProjectId]);

  // Show auth form if not logged in (but allow guest browsing — if no auth
  // requirement is desired for read-only, this gate can be relaxed later).
  // For now, allow unauthenticated access to keep backward compat — the
  // default board still works. Auth is required only for creating projects.
  const { boardState, setBoardState, loading, error, reload } = useBoard(selectedProjectId ?? undefined);
  const { saving, error: mutationError, moveTask, createTask, saveTask, deleteTask, reorderTasks } = useTaskMutations(boardState, reload, setBoardState, selectedProjectId);
  const { cursors, presence, sendCursor } = useRealtime(selectedProjectId, session, {
    onBoardUpdate: () => debouncedReload(),
  });
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Ref to always-read-latest boardState in async DnD handlers
  const boardStateRef = useRef(boardState);
  boardStateRef.current = boardState;

  // Ref for the scrollable board container (for dependency lines)
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Debounced reload — coalesces rapid board-update events from multiple
  // collaborators into a single board fetch (avoids stampede when several
  // mutations arrive within a short window).
  const reloadTimerRef = useRef<number | null>(null);
  const debouncedReload = useCallback(() => {
    if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      reload();
    }, 300);
  }, [reload]);

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
      await api.createDependency(fromTaskId, toTaskId, selectedProjectId ?? undefined);
    } catch (err) {
      console.error('Failed to create dependency:', err);
    }
    reload();
  }, [reload, selectedProjectId]);

  const handleDeleteDependency = useCallback(async (depId: string) => {
    try {
      await api.deleteDependency(depId, selectedProjectId ?? undefined);
    } catch (err) {
      console.error('Failed to delete dependency:', err);
    }
    reload();
  }, [reload, selectedProjectId]);

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
    await api.createRelease({ boardId: state.board.id, name: `Release ${state.releases.length + 1}` }, selectedProjectId ?? undefined);
    reload();
  }, [reload, selectedProjectId]);

  const handleAddSprint = useCallback(async (releaseId: string) => {
    const state = boardStateRef.current;
    const release = state?.releases.find(r => r.id === releaseId);
    await api.createSprint({ releaseId, name: `Sprint ${(release?.sprints.length ?? 0) + 1}` }, selectedProjectId ?? undefined);
    reload();
  }, [reload, selectedProjectId]);

  const handleSelectProject = useCallback((project: Project | null) => {
    setSelectedProjectId(project?.id ?? null);
    // Clear boardState so useBoard reloads for the new project
    setBoardState(null);
  }, [setBoardState]);

  // ─── Cursor tracking for realtime ──────────────────────────
  // Send content-space coordinates: viewport position minus the local pan
  // offset and container origin.  This gives a pan-independent coordinate
  // that every client can translate back to their own screen using their
  // own pan offset.
  const panRef = useRef({ x: 0, y: 0 });
  const handlePanChange = useCallback((p: { x: number; y: number }) => {
    panRef.current = p;
  }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!session || !selectedProjectId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = panRef.current.x;
    const py = panRef.current.y;
    sendCursor(e.clientX - rect.left - px, e.clientY - rect.top - py);
  }, [session, selectedProjectId, sendCursor]);

  const handleAddTask = useCallback(async (sprintId: string) => {
    await createTask(sprintId, 'New Task');
  }, [createTask]);

  const handleSaveTask = useCallback(async (task: Task) => {
    await saveTask(task);
    setEditingTask(null);
  }, [saveTask]);

  const handleDeleteTask = useCallback(async (id: string) => void deleteTask(id), [deleteTask]);

  const handleEditRelease = useCallback(async (id: string, data: { name?: string; targetDate?: string | null; notes?: string | null }) => {
    await api.updateRelease(id, data, selectedProjectId ?? undefined);
    setEditingRelease(null);
    reload();
  }, [reload, selectedProjectId]);

  const handleDeleteRelease = useCallback(async (id: string) => {
    if (!confirm('Delete this release and all its sprints and tasks?')) return;
    await api.deleteRelease(id, selectedProjectId ?? undefined);
    reload();
  }, [reload, selectedProjectId]);

  const handleEditSprint = useCallback(async (id: string, data: {
    name?: string; capacity?: number; capacityUnit?: string;
    startDate?: string | null; endDate?: string | null; notes?: string | null;
  }) => {
    await api.updateSprint(id, data, selectedProjectId ?? undefined);
    setEditingSprint(null);
    reload();
  }, [reload, selectedProjectId]);

  const handleDeleteSprint = useCallback(async (id: string) => {
    if (!confirm('Delete this sprint and all its tasks?')) return;
    await api.deleteSprint(id, selectedProjectId ?? undefined);
    reload();
  }, [reload, selectedProjectId]);

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
    }, selectedProjectId ?? undefined);
    reload();
  }, [reload, selectedProjectId]);

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
      await api.updateStickyNote(id, { x, y }, selectedProjectId ?? undefined);
    } catch (err) {
      console.error('Failed to move sticky note:', err);
      reload();
    }
  }, [reload, setBoardState, selectedProjectId]);

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
      await api.updateStickyNote(id, { text }, selectedProjectId ?? undefined);
    } catch (err) {
      console.error('Failed to update sticky note text:', err);
      reload();
    }
  }, [reload, setBoardState, selectedProjectId]);

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
      await api.deleteStickyNote(id, selectedProjectId ?? undefined);
    } catch (err) {
      console.error('Failed to delete sticky note:', err);
      reload();
    }
  }, [reload, setBoardState, selectedProjectId]);

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
      await api.updateStickyNote(id, { color: nextColor }, selectedProjectId ?? undefined);
    } catch (err) {
      console.error('Failed to update sticky note color:', err);
      reload();
    }
  }, [reload, setBoardState, selectedProjectId]);

  // ─── Note connection handlers ─────────────────────────────

  const handleCreateNoteConnection = useCallback(
    async (noteId: string, toType: NoteConnectionTargetType, toId: string) => {
      try {
        await api.createNoteConnection({ noteId, toType, toId }, selectedProjectId ?? undefined);
      } catch (err) {
        console.error('Failed to create note connection:', err);
      }
      reload();
    },
    [reload, selectedProjectId]
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
      await api.deleteNoteConnection(id, selectedProjectId ?? undefined);
    } catch (err) {
      console.error('Failed to delete note connection:', err);
      reload();
    }
  }, [reload, setBoardState, selectedProjectId]);

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
        <div className="flex items-center gap-4">
          <ProjectSwitcher currentProjectId={selectedProjectId} onSelectProject={handleSelectProject} />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{boardState.board.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {saving ? <span className="text-sm text-gray-400 dark:text-gray-500">Saving...</span> : null}
          {session && selectedProjectId ? (
            <PresenceBar presence={presence} selfMemberId={session.memberId} />
          ) : null}
          {session && selectedProjectId ? (
            <button
              onClick={() => setShowShareDialog(true)}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
              title="Share this project"
            >
              <span>🔗</span> Share
            </button>
          ) : null}
          {session ? (
            <span className="text-sm text-gray-500 dark:text-gray-400">{session.displayName}</span>
          ) : (
            <button
              onClick={() => setShowAuthForm(true)}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Login / Register
            </button>
          )}
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
            <PanCanvas className="flex-1" onPanChange={handlePanChange}>
              <div ref={boardContainerRef} className="relative p-8" onMouseMove={handleMouseMove}>
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

                {/* Realtime remote cursors overlay — fixed-position, outside
                    the pannable area so it never gets clipped or transformed. */}

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

            {/* CursorOverlay outside PanCanvas — fixed to viewport so
                cursors are never clipped by overflow-hidden containers.
                Receives content-space cursor coords and converts them to
                screen-space using the local pan offset + container origin. */}
            {session && selectedProjectId ? (
              <CursorOverlay cursors={cursors} selfMemberId={session.memberId} containerRef={boardContainerRef} panRef={panRef} />
            ) : null}

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

      {/* Auth form modal */}
      {showAuthForm && !session ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAuthForm(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <AuthForm />
          </div>
        </div>
      ) : null}

      {/* Share dialog */}
      {showShareDialog && selectedProjectId ? (
        <ShareDialog
          projectId={selectedProjectId}
          onClose={() => setShowShareDialog(false)}
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
