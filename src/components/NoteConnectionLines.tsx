'use client';

import { useMemo } from 'react';
import ConnectionLines, { type ConnectionSpec } from './ConnectionLines';
import type { NoteConnection } from '@/lib/types';

interface NoteConnectionLinesProps {
  connections: NoteConnection[];
  containerRef: React.RefObject<HTMLElement | null>;
  onDelete?: (id: string) => void;
}

/**
 * NoteConnectionLines — thin adapter that turns the polymorphic
 * `NoteConnection[]` into `ConnectionSpec[]` and delegates rendering to
 * the generic `ConnectionLines` core.
 *
 * Endpoint mapping:
 *   - note → [data-sticky-id="..."]      (always, in the panned layer)
 *   - task → [data-task-id="..."]
 *   - sprint → [data-sprint-id="..."]
 *   - release → [data-release-id="..."]  (added to ReleaseBlock for this feature)
 *
 * Edge policy: lines always exit the note on the right and enter the target
 * on the left. This is a deliberate choice — flipping edges per-target-type
 * would be more "correct" but creates visual inconsistency.
 *
 * Same-column: notes are free-floating, so they never share a sprint
 * ancestor with a task. We omit commonAncestorSelector and let
 * ConnectionLines render standard Béziers.
 */
export default function NoteConnectionLines({
  connections,
  containerRef,
  onDelete,
}: NoteConnectionLinesProps) {
  const specs = useMemo<ConnectionSpec[]>(
    () =>
      connections.map((conn) => ({
        id: conn.id,
        fromSelector: `[data-sticky-id="${conn.noteId}"]`,
        toSelector: selectorForTarget(conn.toType, conn.toId),
        fromEdge: 'right',
        toEdge: 'left',
      })),
    [connections]
  );

  return (
    <ConnectionLines
      connections={specs}
      containerRef={containerRef}
      onDelete={onDelete}
      deleteConfirm="Delete this note connection?"
    />
  );
}

function selectorForTarget(type: string, id: string): string {
  switch (type) {
    case 'task':
      return `[data-task-id="${id}"]`;
    case 'sprint':
      return `[data-sprint-id="${id}"]`;
    case 'release':
      return `[data-release-id="${id}"]`;
    default:
      // Defensive fallback — should never happen given the CHECK constraint
      return `[data-unknown-id="${id}"]`;
  }
}
