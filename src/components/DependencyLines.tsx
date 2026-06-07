'use client';

import { useMemo } from 'react';
import ConnectionLines, { type ConnectionSpec } from './ConnectionLines';
import type { Dependency } from '@/lib/types';

interface DependencyLinesProps {
  dependencies: Dependency[];
  containerRef: React.RefObject<HTMLElement | null>;
  onDeleteDependency?: (depId: string) => void;
}

/**
 * DependencyLines — thin adapter that turns the existing `Dependency` list
 * into `ConnectionSpec`s and delegates rendering to the generic
 * `ConnectionLines` core. Owns only the domain knowledge: "a dependency
 * connects two tasks; same-sprint pairs get the loop-arc treatment".
 */
export default function DependencyLines({
  dependencies,
  containerRef,
  onDeleteDependency,
}: DependencyLinesProps) {
  const connections = useMemo<ConnectionSpec[]>(
    () =>
      dependencies.map((dep) => ({
        id: dep.id,
        fromSelector: `[data-task-id="${dep.fromTaskId}"]`,
        toSelector: `[data-task-id="${dep.toTaskId}"]`,
        // Both endpoints share a [data-sprint-id] ancestor when they're in
        // the same sprint column. ConnectionLines does the same-ancestor test.
        commonAncestorSelector: '[data-sprint-id]',
      })),
    [dependencies]
  );

  return (
    <ConnectionLines
      connections={connections}
      containerRef={containerRef}
      onDelete={onDeleteDependency}
      deleteConfirm="Delete this dependency?"
    />
  );
}
