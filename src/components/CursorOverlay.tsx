'use client';

import { useEffect, useRef, useState } from 'react';
import type { RemoteCursor } from '@/hooks/useRealtime';

interface CursorOverlayProps {
  cursors: Map<string, RemoteCursor>;
  selfMemberId: string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  panRef: React.RefObject<{ x: number; y: number }>;
}

// Color palette for remote cursors — cycles through these per member ID hash
const CURSOR_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#22c55e', // green
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#eab308', // yellow
  '#14b8a6', // teal
];

function colorForMember(memberId: string): string {
  let hash = 0;
  for (let i = 0; i < memberId.length; i++) {
    hash = ((hash << 5) - hash) + memberId.charCodeAt(i);
    hash |= 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export default function CursorOverlay({ cursors, selfMemberId, containerRef, panRef }: CursorOverlayProps) {
  // Track the container's viewport rect so we can convert content-space
  // cursor coords back to screen-space for the fixed-position overlay.
  const [origin, setOrigin] = useState({ left: 0, top: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Re-measure on mount and when the container resizes / scrolls.
  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setOrigin({ left: rect.left, top: rect.top });
      }
      if (panRef.current) setPan(panRef.current);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [containerRef, panRef]);

  // Also poll pan changes (panRef is a mutable ref, not reactive)
  useEffect(() => {
    const id = setInterval(() => {
      if (panRef.current) {
        setPan(prev => (prev.x === panRef.current!.x && prev.y === panRef.current!.y) ? prev : { ...panRef.current });
      }
    }, 100);
    return () => clearInterval(id);
  }, [panRef]);

  // Filter out our own cursor and stale cursors
  const remoteCursors = Array.from(cursors.values()).filter(
    c => c.memberId !== selfMemberId
  );

  if (remoteCursors.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {remoteCursors.map((cursor) => {
        const color = colorForMember(cursor.memberId);
        // Convert content-space coords → screen-space using local pan + container origin
        const screenX = cursor.x + origin.left + pan.x;
        const screenY = cursor.y + origin.top + pan.y;
        return (
          <div
            key={cursor.memberId}
            className="absolute transition-transform duration-75 ease-out"
            style={{
              left: `${screenX}px`,
              top: `${screenY}px`,
              transform: 'translate(0, 0)',
            }}
          >
            {/* SVG cursor arrow */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="drop-shadow-md"
            >
              <path
                d="M4 2 L4 16 L8 12 L11 18 L13 17 L10 11 L16 11 Z"
                fill={color}
                stroke="white"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            {/* Name label */}
            <div
              className="absolute top-5 left-3 px-2 py-0.5 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-sm"
              style={{ backgroundColor: color }}
            >
              {cursor.memberName}
            </div>
          </div>
        );
      })}
    </div>
  );
}