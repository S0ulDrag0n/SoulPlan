'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Dependency } from '@/lib/types';

interface DependencyLinesProps {
  dependencies: Dependency[];
  containerRef: React.RefObject<HTMLElement | null>;
  onDeleteDependency?: (depId: string) => void;
}

interface LineEndpoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depId: string;
  sameColumn: boolean;
}

/**
 * Compute tangent angle at the END of a cubic Bézier.
 * For M p0 C p1 p2 p3, the tangent at p3 is (p3 - p2).
 */
function bezierEndTangent(p2: number[], p3: number[]): number {
  return Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
}

/**
 * SVG overlay that draws dependency lines between task cards.
 *
 * Coordinate system: the SVG is `position: absolute; top:0; left:0`
 * inside the container, so (0,0) corresponds to the container's padding-box
 * origin. We use the SVG element's own getBoundingClientRect() as the
 * reference frame to convert card viewport positions to SVG coords.
 *
 * - From-task: line exits from the mid-right edge of the source card
 * - To-task: line enters the mid-left edge of the target card, with arrowhead pointing inward
 * - Same-column: loop arc exits right, curves around, re-enters left
 * - Cross-column: standard cubic Bézier
 * - Click-to-delete on lines with wide invisible hit area
 */
export default function DependencyLines({ dependencies, containerRef, onDeleteDependency }: DependencyLinesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);

  const updateLines = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      const svg = svgRef.current;
      if (!container || !svg) return;

      // Use the SVG's own bounding rect as the coordinate reference.
      // Since the SVG is `absolute top-0 left-0` inside the container,
      // its origin is the container's padding-box origin.
      const svgRect = svg.getBoundingClientRect();

      // Size SVG to match container's scrollable area
      svg.setAttribute('width', container.scrollWidth.toString());
      svg.setAttribute('height', container.scrollHeight.toString());

      // Remove old lines
      const existing = svg.querySelectorAll('.dep-line, .dep-arrow, .dep-hit');
      existing.forEach(el => el.remove());

      // Detect dark mode
      const isDark = document.documentElement.classList.contains('dark');
      const lineColor = isDark ? '#64748b' : '#94a3b8';
      const arrowColor = isDark ? '#94a3b8' : '#64748b';

      const lines: LineEndpoints[] = [];
      for (const dep of dependencies) {
        const fromEl = container.querySelector(`[data-task-id="${dep.fromTaskId}"]`) as HTMLElement | null;
        const toEl = container.querySelector(`[data-task-id="${dep.toTaskId}"]`) as HTMLElement | null;
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const fromSprint = fromEl.closest('[data-sprint-id]');
        const toSprint = toEl.closest('[data-sprint-id]');
        const sameColumn = !!(fromSprint && toSprint && fromSprint === toSprint);

        // Convert viewport coords to SVG-local coords using the SVG's own rect
        // From: mid-right edge of source card
        const x1 = fromRect.right - svgRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
        // To: mid-left edge of target card
        const x2 = toRect.left - svgRect.left;
        const y2 = toRect.top + toRect.height / 2 - svgRect.top;

        lines.push({ x1, y1, x2, y2, depId: dep.id, sameColumn });
      }

      for (const line of lines) {
        let pathD: string;
        let p2: number[], p3: number[];

        if (line.sameColumn) {
          const loopWidth = 60;

          const p0 = [line.x1, line.y1];
          const p1c = [line.x1 + loopWidth, line.y1];
          p2 = [line.x2 + loopWidth, line.y2];
          p3 = [line.x2, line.y2];

          pathD = [
            `M ${p0[0]} ${p0[1]}`,
            `C ${p1c[0]} ${p1c[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`
          ].join(' ');
        } else {
          const dx = line.x2 - line.x1;
          const cpOffset = Math.max(Math.abs(dx) * 0.4, 50);

          const p0 = [line.x1, line.y1];
          const p1c = [line.x1 + cpOffset, line.y1];
          p2 = [line.x2 - cpOffset, line.y2];
          p3 = [line.x2, line.y2];

          pathD = `M ${p0[0]} ${p0[1]} C ${p1c[0]} ${p1c[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`;
        }

        // Main visible path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'dep-line');
        path.setAttribute('d', pathD);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', lineColor);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '6 3');
        path.setAttribute('opacity', '0.7');
        path.setAttribute('data-dep-id', line.depId);
        svg.appendChild(path);

        // Wide invisible hit-area for click-to-delete
        if (onDeleteDependency) {
          const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          hitArea.setAttribute('class', 'dep-hit');
          hitArea.setAttribute('d', pathD);
          hitArea.setAttribute('fill', 'none');
          hitArea.setAttribute('stroke', 'transparent');
          hitArea.setAttribute('stroke-width', '12');
          hitArea.setAttribute('data-dep-id', line.depId);
          hitArea.style.pointerEvents = 'stroke';
          hitArea.style.cursor = 'pointer';
          hitArea.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (e.currentTarget as SVGElement).getAttribute('data-dep-id');
            if (id && confirm('Delete this dependency?')) {
              onDeleteDependency(id);
            }
          });
          hitArea.addEventListener('mouseenter', () => {
            path.setAttribute('stroke', isDark ? '#3b82f6' : '#2563eb');
            path.setAttribute('stroke-width', '3');
            path.setAttribute('opacity', '1');
          });
          hitArea.addEventListener('mouseleave', () => {
            path.setAttribute('stroke', lineColor);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('opacity', '0.7');
          });
          svg.appendChild(hitArea);
        }

        // ─── Arrowhead at the mid-left edge of the target card ───
        // The tangent at p3 (endpoint) is along p3 - p2
        const angle = bezierEndTangent(p2, p3);
        const arrowSize = 8;
        const spread = Math.PI / 7; // ~25° half-angle

        const tipX = line.x2;
        const tipY = line.y2;
        const base1X = tipX - arrowSize * Math.cos(angle - spread);
        const base1Y = tipY - arrowSize * Math.sin(angle - spread);
        const base2X = tipX - arrowSize * Math.cos(angle + spread);
        const base2Y = tipY - arrowSize * Math.sin(angle + spread);

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('class', 'dep-arrow');
        arrow.setAttribute('points', [
          `${tipX},${tipY}`,
          `${base1X},${base1Y}`,
          `${base2X},${base2Y}`,
        ].join(' '));
        arrow.setAttribute('fill', arrowColor);
        arrow.setAttribute('opacity', '0.9');
        svg.appendChild(arrow);
      }
    });
  }, [dependencies, containerRef, onDeleteDependency]);

  // Recalculate lines on mount, board changes, resize, and pointer up (after pan)
  useEffect(() => {
    updateLines();

    const container = containerRef.current;
    if (!container) return;

    const onResize = () => updateLines();
    const onPointerUp = () => {
      requestAnimationFrame(() => updateLines());
    };

    const themeObserver = new MutationObserver(() => updateLines());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener('resize', onResize);
    window.addEventListener('pointerup', onPointerUp);

    const resizeObserver = new ResizeObserver(() => updateLines());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onPointerUp);
      resizeObserver.disconnect();
      themeObserver.disconnect();
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