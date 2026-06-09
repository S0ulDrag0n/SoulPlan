'use client';

import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import type { NoteConnectionTargetType } from '@/lib/types';

// ─── Context ──────────────────────────────────────────────

interface NoteConnectionMode {
  sourceNoteId: string;
  /** The connector handle element — temp line starts from here */
  sourceHandleEl: HTMLElement;
}

interface NoteConnectorState {
  connectionMode: NoteConnectionMode | null;
  hoveredTarget: { type: NoteConnectionTargetType; id: string } | null;
}

interface NoteConnectorContextValue extends NoteConnectorState {
  startConnection: (noteId: string, handleEl: HTMLElement) => void;
  cancelConnection: () => void;
}

const NoteConnectorContext = createContext<NoteConnectorContextValue | null>(null);

export function useNoteConnector() {
  const ctx = useContext(NoteConnectorContext);
  if (!ctx) throw new Error('useNoteConnector must be used within NoteConnectorProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────

interface ProviderProps {
  children: ReactNode;
  noteConnections: { id: string; noteId: string; toType: NoteConnectionTargetType; toId: string }[];
  onCreateConnection: (
    noteId: string,
    toType: NoteConnectionTargetType,
    toId: string
  ) => Promise<void>;
}

export function NoteConnectorProvider({
  children,
  noteConnections: noteConnectionsProp,
  onCreateConnection,
}: ProviderProps) {
  const [connectionMode, setConnectionMode] = useState<NoteConnectionMode | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<{ type: NoteConnectionTargetType; id: string } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Refs to avoid stale closures in event listeners
  const connectionModeRef = useRef(connectionMode);
  const noteConnectionsRef = useRef(noteConnectionsProp);
  const onCreateConnectionRef = useRef(onCreateConnection);

  connectionModeRef.current = connectionMode;
  noteConnectionsRef.current = noteConnectionsProp;
  onCreateConnectionRef.current = onCreateConnection;

  const startConnection = useCallback((noteId: string, handleEl: HTMLElement) => {
    setConnectionMode({ sourceNoteId: noteId, sourceHandleEl: handleEl });
    setHoveredTarget(null);
    setCursorPos(null);
  }, []);

  const cancelConnection = useCallback(() => {
    setConnectionMode(null);
    setHoveredTarget(null);
    setCursorPos(null);
  }, []);

  // Register window-level listeners ONCE
  useEffect(() => {
    /**
     * Walk up the DOM to find a droppable target. We look for:
     *  - data-task-id (closest)
     *  - data-sprint-id (closest, only if no task)
     *  - data-release-id (closest, only if no sprint/task)
     *
     * The closest() order ensures we get the most specific container
     * (task inside sprint inside release).
     */
    const findTarget = (el: Element | null): { type: NoteConnectionTargetType; id: string } | null => {
      if (!el) return null;
      const taskEl = el.closest('[data-task-id]');
      if (taskEl) {
        return { type: 'task', id: taskEl.getAttribute('data-task-id')! };
      }
      const sprintEl = el.closest('[data-sprint-id]');
      if (sprintEl) {
        return { type: 'sprint', id: sprintEl.getAttribute('data-sprint-id')! };
      }
      const releaseEl = el.closest('[data-release-id]');
      if (releaseEl) {
        return { type: 'release', id: releaseEl.getAttribute('data-release-id')! };
      }
      return null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const cm = connectionModeRef.current;
      if (!cm) return;
      setCursorPos({ x: e.clientX, y: e.clientY });
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      // Don't highlight the source note itself
      const stickyUnder = elUnder?.closest('[data-sticky-id]');
      if (stickyUnder && stickyUnder.getAttribute('data-sticky-id') === cm.sourceNoteId) {
        setHoveredTarget(null);
        return;
      }
      setHoveredTarget(findTarget(elUnder));
    };

    const handlePointerUp = (e: PointerEvent) => {
      const cm = connectionModeRef.current;
      if (!cm) return;
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const target = findTarget(elUnder);

      if (
        target &&
        !noteConnectionsRef.current.some(
          (c) =>
            c.noteId === cm.sourceNoteId &&
            c.toType === target.type &&
            c.toId === target.id
        )
      ) {
        setConnectionMode(null);
        setHoveredTarget(null);
        setCursorPos(null);
        onCreateConnectionRef.current(cm.sourceNoteId, target.type, target.id).catch(() => {});
        return;
      }
      setConnectionMode(null);
      setHoveredTarget(null);
      setCursorPos(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connectionModeRef.current) {
        setConnectionMode(null);
        setHoveredTarget(null);
        setCursorPos(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Compute temp line endpoints
  const tempLine: { x1: number; y1: number; x2: number; y2: number } | null = connectionMode
    ? (() => {
        const handleRect = connectionMode.sourceHandleEl.getBoundingClientRect();
        const x1 = handleRect.left + handleRect.width / 2;
        const y1 = handleRect.top + handleRect.height / 2;

        if (hoveredTarget) {
          // Find the target element and snap to its left edge
          const sel = `[data-${hoveredTarget.type}-id="${hoveredTarget.id}"]`;
          const targetEl = document.querySelector(sel) as HTMLElement | null;
          if (targetEl) {
            const targetRect = targetEl.getBoundingClientRect();
            return {
              x1,
              y1,
              x2: targetRect.left,
              y2: targetRect.top + targetRect.height / 2,
            };
          }
        }
        return cursorPos ? { x1, y1, x2: cursorPos.x, y2: cursorPos.y } : null;
      })()
    : null;

  return (
    <NoteConnectorContext.Provider
      value={{ connectionMode, hoveredTarget, startConnection, cancelConnection }}
    >
      {children}

      {/* Temporary connection line overlay */}
      {connectionMode ? (
        tempLine ? (
          <svg
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 9999, width: '100vw', height: '100vh' }}
          >
            <defs>
              <marker id="note-conn-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#f59e0b" opacity="0.9" />
              </marker>
            </defs>
            <path
              d={`M ${tempLine.x1} ${tempLine.y1} C ${tempLine.x1 + 80} ${tempLine.y1}, ${tempLine.x2 - 80} ${tempLine.y2}, ${tempLine.x2} ${tempLine.y2}`}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray="8 4"
              opacity="0.9"
              markerEnd="url(#note-conn-arrow)"
            />
            <circle cx={tempLine.x1} cy={tempLine.y1} r="5" fill="#f59e0b" opacity="0.9" />
            {hoveredTarget ? (
              <circle cx={tempLine.x2} cy={tempLine.y2} r="5" fill="#10b981" opacity="0.9" />
            ) : null}
          </svg>
        ) : null
      ) : null}

      {/* Connection mode banner */}
      {connectionMode ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-amber-500 text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
          <span className="inline-block w-2 h-2 bg-green-300 rounded-full animate-pulse" />
          <span>
            Drop on a task, sprint, or release to connect • Press Esc to cancel
          </span>
        </div>
      ) : null}
    </NoteConnectorContext.Provider>
  );
}
