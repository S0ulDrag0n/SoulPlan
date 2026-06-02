'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Dependency } from '@/lib/types';

interface DependencyLinesProps {
  dependencies: Dependency[];
  containerRef: React.RefObject<HTMLElement | null>;
}

interface LineEndpoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * SVG overlay that draws dependency lines between task cards.
 * Uses data-task-id attributes to locate cards and compute endpoints.
 * Lines go from the right edge of the "from" card to the left edge of the "to" card.
 *
 * Works with the pannable canvas: uses the board container reference
 * to compute SVG dimensions and element positions correctly.
 */
export default function DependencyLines({ dependencies, containerRef }: DependencyLinesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);

  const updateLines = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!svgRef.current || !containerRef.current) return;

      const container = containerRef.current;

      // Size the SVG to match the full board content area
      svgRef.current.setAttribute('width', String(container.scrollWidth));
      svgRef.current.setAttribute('height', String(container.scrollHeight));

      // Calculate line endpoints for each dependency
      // Use offsetLeft/offsetTop relative to the container for positioning
      const lines: LineEndpoints[] = [];

      for (const dep of dependencies) {
        const fromEl = container.querySelector(`[data-task-id="${dep.fromTaskId}"]`);
        const toEl = container.querySelector(`[data-task-id="${dep.toTaskId}"]`);
        if (!fromEl || !toEl) continue;

        // getBoundingClientRect gives viewport coords — we need coords relative
        // to the container's scrollable content area.
        // Since the container is inside a CSS transform, getBoundingClientRect
        // already accounts for the pan offset, so we compute relative to container.
        const containerRect = container.getBoundingClientRect();

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        // Relative to container top-left, accounting for container's scroll
        const x1 = fromRect.right - containerRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
        const x2 = toRect.left - containerRect.left;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top;

        lines.push({ x1, y1, x2, y2 });
      }

      // Build SVG path elements
      const svg = svgRef.current;

      // Clear previous lines
      const existing = svg.querySelectorAll('.dep-line, .dep-arrow');
      existing.forEach(el => el.remove());

      for (const line of lines) {
        // Control points for a smooth Bézier curve
        const dx = line.x2 - line.x1;
        // If tasks are in the same column or very close, add extra curvature
        const cpOffset = Math.max(Math.abs(dx) * 0.4, 50);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'dep-line');
        path.setAttribute('d', `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#94a3b8');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '6 3');
        path.setAttribute('opacity', '0.7');
        svg.appendChild(path);

        // Arrowhead at the end (to-task side)
        // The curve always enters the target card horizontally (tangent points right)
        const arrowSize = 7;
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('class', 'dep-arrow');
        arrow.setAttribute('points', [
          `${line.x2},${line.y2}`,
          `${line.x2 - arrowSize * Math.cos(-Math.PI / 6)},${line.y2 - arrowSize * Math.sin(-Math.PI / 6)}`,
          `${line.x2 - arrowSize * Math.cos(Math.PI / 6)},${line.y2 - arrowSize * Math.sin(Math.PI / 6)}`,
        ].join(' '));
        arrow.setAttribute('fill', '#94a3b8');
        arrow.setAttribute('opacity', '0.7');
        svg.appendChild(arrow);
      }
    });
  }, [dependencies, containerRef]);

  // Recalculate lines on mount, board changes, resize, and pointer up (after pan)
  useEffect(() => {
    updateLines();

    const container = containerRef.current;
    if (!container) return;

    // Re-draw on resize and after any pointer events (pan, drag, etc.)
    const onResize = () => updateLines();
    const onPointerUp = () => {
      // After a pan gesture, the layout may shift
      requestAnimationFrame(() => updateLines());
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for DOM layout changes (task add/remove, etc.)
    const observer = new ResizeObserver(() => updateLines());
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onPointerUp);
      observer.disconnect();
    };
  }, [updateLines, containerRef]);

  return (
    <svg
      ref={svgRef}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}