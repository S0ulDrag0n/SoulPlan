'use client';

import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import type { Dependency } from '@/lib/types';

// ─── Context ──────────────────────────────────────────────

interface ConnectionMode {
  sourceTaskId: string;
  sourceEl: HTMLElement;
}

interface DependencyConnectorState {
  connectionMode: ConnectionMode | null;
  hoveredTaskId: string | null;
}

interface DependencyConnectorContextValue extends DependencyConnectorState {
  startConnection: (taskId: string, el: HTMLElement) => void;
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
  dependencies,
  onCreateDependency,
  containerRef,
}: ProviderProps) {
  const [connectionMode, setConnectionMode] = useState<ConnectionMode | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingDep, setPendingDep] = useState(false);

  const startConnection = useCallback((taskId: string, el: HTMLElement) => {
    setConnectionMode({ sourceTaskId: taskId, sourceEl: el });
    setHoveredTaskId(null);
  }, []);

  const cancelConnection = useCallback(() => {
    setConnectionMode(null);
    setHoveredTaskId(null);
    setCursorPos(null);
  }, []);

  // Track pointer movement during connection mode
  useEffect(() => {
    if (!connectionMode) return;

    const handlePointerMove = (e: PointerEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });

      // Find which task card is under the cursor
      const container = containerRef.current;
      if (!container) return;

      // Temporarily hide the SVG overlay + temp line so elementFromPoint hits task cards
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      if (elUnder) {
        const taskCard = (elUnder as HTMLElement).closest('[data-task-id]');
        const taskId = taskCard ? (taskCard as HTMLElement).getAttribute('data-task-id') : null;
        setHoveredTaskId(taskId);

        // Prevent self-connections & duplicates
        if (taskId && taskId === connectionMode.sourceTaskId) {
          setHoveredTaskId(null);
          return;
        }
        if (
          taskId &&
          dependencies.some(
            (d) => d.fromTaskId === connectionMode.sourceTaskId && d.toTaskId === taskId
          )
        ) {
          setHoveredTaskId(null);
          return;
        }
      } else {
        setHoveredTaskId(null);
      }
    };

    const handlePointerUp = async (e: PointerEvent) => {
      if (!connectionMode) return;

      // Find target task card under cursor
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const taskCard = elUnder ? (elUnder as HTMLElement).closest('[data-task-id]') : null;
      const targetTaskId = taskCard
        ? (taskCard as HTMLElement).getAttribute('data-task-id')
        : null;

      if (
        targetTaskId &&
        targetTaskId !== connectionMode.sourceTaskId &&
        !dependencies.some(
          (d) => d.fromTaskId === connectionMode.sourceTaskId && d.toTaskId === targetTaskId
        )
      ) {
        setPendingDep(true);
        try {
          await onCreateDependency(connectionMode.sourceTaskId, targetTaskId);
        } finally {
          setPendingDep(false);
        }
      }

      // Always clean up connection mode
      setConnectionMode(null);
      setHoveredTaskId(null);
      setCursorPos(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelConnection();
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
  }, [connectionMode, dependencies, onCreateDependency, cancelConnection, containerRef]);

  // Compute temp line endpoints (relative to viewport for fixed-position SVG)
  const tempLine: { x1: number; y1: number; x2: number; y2: number } | null = connectionMode
    ? (() => {
        const sourceRect = connectionMode.sourceEl.getBoundingClientRect();
        // Line starts from the connector handle (bottom-right of card)
        const x1 = sourceRect.right - 4;
        const y1 = sourceRect.bottom - 4;
        // Line ends at cursor (or center of hovered card)
        if (hoveredTaskId && containerRef.current) {
          const targetEl = containerRef.current.querySelector(
            `[data-task-id="${hoveredTaskId}"]`
          );
          if (targetEl) {
            const targetRect = targetEl.getBoundingClientRect();
            return { x1, y1, x2: targetRect.left + 4, y2: targetRect.top + targetRect.height / 2 };
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

      {/* Temporary connection line overlay (fixed position, covers viewport) */}
      {connectionMode && tempLine && (
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
          {/* Source dot */}
          <circle cx={tempLine.x1} cy={tempLine.y1} r="5" fill="#3b82f6" opacity="0.9" />
          {/* Target dot when hovering a card */}
          {hoveredTaskId && (
            <circle cx={tempLine.x2} cy={tempLine.y2} r="5" fill="#10b981" opacity="0.9" />
          />
        </svg>
      )}

      {/* Connection mode banner */}
      {connectionMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-blue-600 text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>
            Drag to a task to create dependency • <button onClick={cancelConnection} className="underline hover:text-blue-200">Cancel</button> • Press Esc
          </span>
        </div>
      )}
    </DependencyConnectorContext.Provider>
  );
}