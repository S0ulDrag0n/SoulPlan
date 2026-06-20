'use client';

import type { RemoteCursor } from '@/hooks/useRealtime';

interface CursorOverlayProps {
  cursors: Map<string, RemoteCursor>;
  selfMemberId: string | null;
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

export default function CursorOverlay({ cursors, selfMemberId }: CursorOverlayProps) {
  // Filter out our own cursor and stale cursors
  const remoteCursors = Array.from(cursors.values()).filter(
    c => c.memberId !== selfMemberId
  );

  if (remoteCursors.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {remoteCursors.map((cursor) => {
        const color = colorForMember(cursor.memberId);
        return (
          <div
            key={cursor.memberId}
            className="absolute transition-transform duration-75 ease-out"
            style={{
              left: `${cursor.x}px`,
              top: `${cursor.y}px`,
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