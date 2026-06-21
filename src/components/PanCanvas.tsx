'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface PanCanvasProps {
  children: ReactNode;
  className?: string;
}

/**
 * A Miro-like pannable canvas. Supports:
 * - Middle-click drag to pan
 * - Space + left-click drag to pan
 * - The content area is translated via CSS transform
 *
 * DnD integration: pointer events from sortable cards bubble up.
 * We only start panning on middle-click OR space+left-click,
 * so regular left-click drag for card reordering is unaffected.
 */
export default function PanCanvas({ children, className = '' }: PanCanvasProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Track space key for pan mode — only when no input/textarea is focused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        setIsPanning(false);
      }
    };
    const onBlur = () => {
      setSpaceHeld(false);
      setIsPanning(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only start panning on middle-click OR space+left-click
    const isMiddleClick = e.button === 1;
    const isSpacePan = spaceHeld && e.button === 0;

    if (!isMiddleClick && !isSpacePan) return;

    e.preventDefault();
    e.stopPropagation(); // Don't let this become a dnd-kit drag
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan, spaceHeld]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  }, [isPanning]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Build cursor style
  const cursorStyle = isPanning ? 'grabbing' : spaceHeld ? 'grab' : undefined;

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={cursorStyle ? { cursor: cursorStyle } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Pannable content */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          willChange: isPanning ? 'transform' : undefined,
        }}
      >
        {children}
      </div>

      {/* Pan hint — shows briefly when space is held */}
      {spaceHeld && !isPanning && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none opacity-70">
          Hold + drag to pan • Middle-click to pan
        </div>
      )}
    </div>
  );
}