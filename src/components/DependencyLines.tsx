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
  depId: string;
}

/**
 * SVG overlay that draws dependency lines between task cards.
 * Uses data-task-id attributes to locate cards and compute endpoints.
 * Lines go from the right edge of the "from" card to the left edge of the "to" card.
 */
export default function DependencyLines({ dependencies, containerRef }: DependencyLinesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);

  const updateLines = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!svgRef.current || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      // Size the SVG to match the scrollable area
      const scrollWidth = container.scrollWidth;
      const scrollHeight = container.scrollHeight;
      svgRef.current.setAttribute('width', String(scrollWidth));
      svgRef.current.setAttribute('height', String(scrollHeight));

      // Calculate line endpoints for each dependency
      const lines: LineEndpoints[] = [];

      for (const dep of dependencies) {
        const fromEl = container.querySelector(`[data-task-id="${dep.fromTaskId}"]`);
        const toEl = container.querySelector(`[data-task-id="${dep.toTaskId}"]`);
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        // Convert from viewport coords to container-relative coords
        // Account for scroll position
        const x1 = fromRect.right - containerRect.left + container.scrollLeft;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top + container.scrollTop;
        const x2 = toRect.left - containerRect.left + container.scrollLeft;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top + container.scrollTop;

        lines.push({ x1, y1, x2, y2, depId: dep.id });
      }

      // Build SVG path elements
      const svg = svgRef.current;

      // Clear previous lines
      const existing = svg.querySelectorAll('.dep-line, .dep-arrow');
      existing.forEach(el => el.remove());

      for (const line of lines) {
        // Control points for a smooth Bézier curve
        const dx = line.x2 - line.x1;
        const cpOffset = Math.max(Math.abs(dx) * 0.4, 40);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'dep-line');
        path.setAttribute('d', `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#94a3b8');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '6 3');
        path.setAttribute('opacity', '0.6');
        svg.appendChild(path);

        // Arrowhead at the end (to-task side)
        // The curve always enters the target card horizontally (tangent points right)
        const arrowSize = 6;
        const angle = 0; // horizontal entry from left

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('class', 'dep-arrow');
        arrow.setAttribute('points', [
          `${line.x2},${line.y2}`,
          `${line.x2 - arrowSize * Math.cos(angle - Math.PI / 6)},${line.y2 - arrowSize * Math.sin(angle - Math.PI / 6)}`,
          `${line.x2 - arrowSize * Math.cos(angle + Math.PI / 6)},${line.y2 - arrowSize * Math.sin(angle + Math.PI / 6)}`,
        ].join(' '));
        arrow.setAttribute('fill', '#94a3b8');
        arrow.setAttribute('opacity', '0.6');
        svg.appendChild(arrow);
      }
    });
  }, [dependencies, containerRef]);

  // Recalculate lines on mount, board changes, scroll, and resize
  useEffect(() => {
    updateLines();

    const container = containerRef.current;
    if (!container) return;

    // Re-draw on scroll and resize
    const onScroll = () => updateLines();
    const onResize = () => updateLines();

    container.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onResize);

    // Also use ResizeObserver for layout changes (task add/remove)
    const observer = new ResizeObserver(() => updateLines());
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
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