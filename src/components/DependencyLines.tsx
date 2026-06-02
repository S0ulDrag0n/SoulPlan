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
 * SVG overlay that draws dependency lines between task cards.
 * Uses data-task-id attributes to locate cards and compute endpoints.
 * Lines go from the right-center of the "from" card to the left-center of the "to" card.
 * For same-column dependencies, draws a loop arc that exits right, curves down/up, and re-enters left.
 * Uses cubic Bézier curves and triangle arrowheads. Supports click-to-delete on lines.
 * Re-draws on board changes, resize, pointer events (after pan/drag), and theme changes.
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

      const containerRect = container.getBoundingClientRect();

      // Size SVG to match container
      svg.setAttribute('width', container.scrollWidth.toString());
      svg.setAttribute('height', container.scrollHeight.toString());

      // Remove old lines
      const existing = svg.querySelectorAll('.dep-line, .dep-arrow, .dep-hit');
      existing.forEach(el => el.remove());

      // Detect dark mode for stroke color
      const isDark = document.documentElement.classList.contains('dark');
      const lineColor = isDark ? '#64748b' : '#94a3b8'; // slate-500 : slate-400

      // Compute line endpoints for each dependency
      const lines: LineEndpoints[] = [];
      for (const dep of dependencies) {
        const fromEl = container.querySelector(`[data-task-id="${dep.fromTaskId}"]`) as HTMLElement | null;
        const toEl = container.querySelector(`[data-task-id="${dep.toTaskId}"]`) as HTMLElement | null;
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        // Check if same sprint column (same parent sprint container)
        const fromSprint = fromEl.closest('[data-sprint-id]');
        const toSprint = toEl.closest('[data-sprint-id]');
        const sameColumn = !!(fromSprint && toSprint && fromSprint === toSprint);

        // Convert viewport coordinates to container-relative coordinates
        const x1 = fromRect.right - containerRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
        const x2 = toRect.left - containerRect.left;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top;

        lines.push({ x1, y1, x2, y2, depId: dep.id, sameColumn });
      }

      for (const line of lines) {
        let pathD: string;

        if (line.sameColumn) {
          // Same column — draw a loop arc that exits right, curves around, and re-enters left
          const loopWidth = 60; // How far the arc extends to the right
          const dy = line.y2 - line.y1;

          // Exit from right of source, curve right and down/up, enter left of target
          pathD = [
            `M ${line.x1} ${line.y1}`,
            `C ${line.x1 + loopWidth} ${line.y1}, ${line.x1 + loopWidth} ${line.y1 + dy * 0.3},`,
            `${line.x1 + loopWidth * 0.7} ${line.y1 + dy * 0.5}`,
            `C ${line.x1 + loopWidth * 0.4} ${line.y1 + dy * 0.7}, ${line.x2 + loopWidth * 0.7} ${line.y2},`,
            `${line.x2} ${line.y2}`
          ].join(' ');
        } else {
          // Cross-column — standard Bézier
          const dx = line.x2 - line.x1;
          const cpOffset = Math.max(Math.abs(dx) * 0.4, 50);
          pathD = `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`;
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

        // Wide invisible hit-area for click-to-delete (pointer-events enabled on this)
        if (onDeleteDependency) {
          const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          hitArea.setAttribute('class', 'dep-hit');
          hitArea.setAttribute('d', pathD);
          hitArea.setAttribute('fill', 'none');
          hitArea.setAttribute('stroke', 'transparent');
          hitArea.setAttribute('stroke-width', '12'); // Wide hit area
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
          // Hover: highlight the visible path
          hitArea.addEventListener('mouseenter', () => {
            path.setAttribute('stroke', isDark ? '#3b82f6' : '#2563eb'); // blue-500/600
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

        // Arrowhead at the end (to-task side)
        const arrowSize = 7;
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('class', 'dep-arrow');
        if (line.sameColumn) {
          // Arrow points left (entering target from the right side... no, from the left)
          arrow.setAttribute('points', [
            `${line.x2},${line.y2}`,
            `${line.x2 + arrowSize},${line.y2 - arrowSize * 0.6}`,
            `${line.x2 + arrowSize},${line.y2 + arrowSize * 0.6}`,
          ].join(' '));
        } else {
          arrow.setAttribute('points', [
            `${line.x2},${line.y2}`,
            `${line.x2 - arrowSize * Math.cos(-Math.PI / 6)},${line.y2 - arrowSize * Math.sin(-Math.PI / 6)}`,
            `${line.x2 - arrowSize * Math.cos(Math.PI / 6)},${line.y2 + arrowSize * Math.sin(Math.PI / 6)}`,
          ].join(' '));
        }
        arrow.setAttribute('fill', lineColor);
        arrow.setAttribute('opacity', '0.7');
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

    // Watch for dark mode class changes on <html>
    const themeObserver = new MutationObserver(() => updateLines());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener('resize', onResize);
    window.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for DOM layout changes
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