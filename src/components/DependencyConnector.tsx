'use client';

import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import type { Dependency } from '@/lib/types';

// ─── Context ──────────────────────────────────────────────

interface ConnectionMode {
  sourceTaskId: string;
  /** The connector button element (🔗) — temp line starts from here */
  sourceHandleEl: HTMLElement;
}

interface DependencyConnectorState {
  connectionMode: ConnectionMode | null;
  hoveredTaskId: string | null;
}

interface DependencyConnectorContextValue extends DependencyConnectorState {
  startConnection: (taskId: string, handleEl: HTMLElement) => void;
  cancelConnection: () => void;
  setHoveredTaskId: (id: string | null) => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

const DependencyConnectorContext = createContext<DependencyConnectorContextValue | null>(null);

export function useDependencyConnector() {
  const ctx = useContext(DependencyConnectorContext);
  if (!ctx) throw new Error('useDependencyConnector must be used within DependencyConnectorProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────

interface ProviderProps {
  children: ReactNode;
  dependencies: Dependency[];
  onCreateDependency: (fromTaskId: string, toTaskId: string) => Promise<void>;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function DependencyConnectorProvider({
  children,
  dependencies: dependenciesProp,
  onCreateDependency,
  containerRef,
}: ProviderProps) {
  const [connectionMode, setConnectionMode] = useState<ConnectionMode | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // ── Refs to avoid stale closures in event listeners ──
  const connectionModeRef = useRef<ConnectionMode | null>(null);
  const dependenciesRef = useRef(dependenciesProp);
  const onCreateDependencyRef = useRef(onCreateDependency);

  connectionModeRef.current = connectionMode;
  dependenciesRef.current = dependenciesProp;
  onCreateDependencyRef.current = onCreateDependency;

  const startConnection = useCallback((taskId: string, handleEl: HTMLElement) => {
    setConnectionMode({ sourceTaskId: taskId, sourceHandleEl: handleEl });
    setHoveredTaskId(null);
    setCursorPos(null);
  }, []);

  const cancelConnection = useCallback(() => {
    setConnectionMode(null);
    setHoveredTaskId(null);
    setCursorPos(null);
  }, []);

  // ── Register window-level listeners ONCE ──
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const cm = connectionModeRef.current;
      if (!cm) return;

      setCursorPos({ x: e.clientX, y: e.clientY });

      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      if (elUnder) {
        const taskCard = (elUnder as HTMLElement).closest('[data-task-id]');
        const taskId = taskCard ? (taskCard as HTMLElement).getAttribute('data-task-id') : null;

        if (taskId && taskId === cm.sourceTaskId) {
          setHoveredTaskId(null);
          return;
        }
        if (
          taskId &&
          dependenciesRef.current.some(
            (d) => d.fromTaskId === cm.sourceTaskId && d.toTaskId === taskId
          )
        ) {
          setHoveredTaskId(null);
          return;
        }

        setHoveredTaskId(taskId);
      } else {
        setHoveredTaskId(null);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const cm = connectionModeRef.current;
      if (!cm) return;

      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const taskCard = elUnder ? (elUnder as HTMLElement).closest('[data-task-id]') : null;
      const targetTaskId = taskCard
        ? (taskCard as HTMLElement).getAttribute('data-task-id')
        : null;

      if (
        targetTaskId &&
        targetTaskId !== cm.sourceTaskId &&
        !dependenciesRef.current.some(
          (d) => d.fromTaskId === cm.sourceTaskId && d.toTaskId === targetTaskId
        )
      ) {
        setConnectionMode(null);
        setHoveredTaskId(null);
        setCursorPos(null);

        onCreateDependencyRef.current(cm.sourceTaskId, targetTaskId).catch(() => {});
        return;
      }

      setConnectionMode(null);
      setHoveredTaskId(null);
      setCursorPos(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connectionModeRef.current) {
        setConnectionMode(null);
        setHoveredTaskId(null);
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

  // Compute temp line endpoints:
  // Start: center of the 🔗 connector button
  // End: mid-left edge of hovered target card, or cursor position
  const tempLine: { x1: number; y1: number; x2: number; y2: number } | null = connectionMode
    ? (() => {
        const handleRect = connectionMode.sourceHandleEl.getBoundingClientRect();
        const x1 = handleRect.left + handleRect.width / 2;
        const y1 = handleRect.top + handleRect.height / 2;

        if (hoveredTaskId && containerRef.current) {
          const targetEl = containerRef.current.querySelector(
            `[data-task-id="${hoveredTaskId}"]`
          );
          if (targetEl) {
            const targetRect = targetEl.getBoundingClientRect();
            // Snap to mid-left edge of target card
            const x2 = targetRect.left;
            const y2 = targetRect.top + targetRect.height / 2;
            return { x1, y1, x2, y2 };
          }
        }
        return cursorPos ? { x1, y1, x2: cursorPos.x, y2: cursorPos.y } : null;
      })()
    : null;

  return (
    <DependencyConnectorContext.Provider
      value={{
        connectionMode,
        hoveredTaskId,
        startConnection,
        cancelConnection,
        setHoveredTaskId,
        containerRef,
      }}
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
              <marker id="conn-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#3b82f6" opacity="0.8" />
              </marker>
            </defs>
            <path
              d={`M ${tempLine.x1} ${tempLine.y1} C ${tempLine.x1 + 80} ${tempLine.y1}, ${tempLine.x2 - 80} ${tempLine.y2}, ${tempLine.x2} ${tempLine.y2}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeDasharray="8 4"
              opacity="0.8"
              markerEnd="url(#conn-arrow)"
            />
            {/* Source dot on connector button */}
            <circle cx={tempLine.x1} cy={tempLine.y1} r="5" fill="#3b82f6" opacity="0.9" />
            {/* Target dot on hovered card left edge */}
            {hoveredTaskId ? (
              <circle cx={tempLine.x2} cy={tempLine.y2} r="5" fill="#10b981" opacity="0.9" />
            ) : null}
          </svg>
        ) : null
      ) : null}

      {/* Connection mode banner */}
      {connectionMode ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-blue-600 text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
          <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>
            Drag to a task to create dependency • Press Esc to cancel
          </span>
        </div>
      ) : null}
    </DependencyConnectorContext.Provider>
  );
}