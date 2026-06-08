'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * ConnectionLines — generic SVG line renderer.
 *
 * Draws cubic Bézier curves (or same-column loop arcs) between pairs of
 * DOM elements. Knows NOTHING about tasks, notes, releases, or sprints —
 * callers specify the connections declaratively via CSS selectors, and this
 * component does the geometry, the theme-aware styling, the click-to-delete
 * hit areas, and the resize/redraw orchestration.
 *
 * Coordinate system:
 *   The SVG is mounted `absolute top-0 left-0` inside the container, so its
 *   origin coincides with the container's padding-box origin. We convert
 *   card viewport coords to SVG-local coords using `svg.getBoundingClientRect()`
 *   as the reference frame. Because both the SVG and the connected elements
 *   share the same transformed coordinate system (e.g. inside PanCanvas's
 *   `translate(x,y)`), pan/zoom stays invariant — the relative offsets are
 *   what we draw between.
 *
 * Same-column heuristic:
 *   If `sameColumn` is true on a connection, the line detours out to the
 *   right of the source, loops around, and re-enters from the right of the
 *   target. Callers determine this from their domain (e.g. same sprint for
 *   task→task dependencies); this component just trusts the flag.
 *
 * Dark mode:
 *   We read the `dark` class on `<html>` on every redraw. Lines and arrowheads
 *   use slate-400 in dark mode, slate-500 in light. The MutationObserver in
 *   the effect below catches theme toggles immediately.
 */

export interface ConnectionSpec {
  /** Stable id, used for the data attribute and delete callback */
  id: string;
  /** CSS selector that uniquely identifies the source element within the container */
  fromSelector: string;
  /** CSS selector that uniquely identifies the target element within the container */
  toSelector: string;
  /**
   * If provided, the connection is treated as same-column when both endpoints
   * share a common ancestor matching this selector — and rendered as a loop
   * arc that detours out to the right and re-enters from the right.
   *
   * E.g. for task→task dependencies, pass `'[data-sprint-id]'`: two tasks in
   * the same sprint column will get the loop-arc treatment. For free-floating
   * note connections, omit this — notes don't belong to a column.
   */
  commonAncestorSelector?: string;
  /**
   * Optional: which edge of the source card the line exits from.
   * Default: 'auto' (the edge facing the target is chosen automatically).
   */
  fromEdge?: 'left' | 'right' | 'top' | 'bottom' | 'auto';
  /**
   * Optional: which edge of the target card the line enters at.
   * Default: 'auto' (the edge facing the source is chosen automatically).
   */
  toEdge?: 'left' | 'right' | 'top' | 'bottom' | 'auto';
  /**
   * Optional visual override — a CSS color for the line + arrowhead.
   * If omitted, uses the theme-aware slate defaults.
   */
  color?: string;
}

interface ConnectionLinesProps {
  connections: ConnectionSpec[];
  containerRef: React.RefObject<HTMLElement | null>;
  onDelete?: (id: string) => void;
  /**
   * Optional confirm message shown before deletion.
   * If omitted, deletion happens immediately.
   */
  deleteConfirm?: string;
  /**
   * Optional z-index for the SVG overlay. Default: 1.
   */
  zIndex?: number;
}

interface ComputedLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sameColumn: boolean;
  color: string;
  fromEdge: 'left' | 'right' | 'top' | 'bottom';
  toEdge: 'left' | 'right' | 'top' | 'bottom';
}

/**
 * Compute the tangent angle at the END of a cubic Bézier.
 * For M p0 C p1 p2 p3, the tangent at p3 is (p3 - p2).
 */
function bezierEndTangent(p2: number[], p3: number[]): number {
  return Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
}

/**
 * Resolve a point on the edge of a rect.
 * - 'right' returns the mid-right edge
 * - 'left' returns the mid-left edge
 * - 'top' returns the mid-top edge
 * - 'bottom' returns the mid-bottom edge
 */
function edgePoint(rect: DOMRect, edge: 'left' | 'right' | 'top' | 'bottom'): { x: number; y: number } {
  switch (edge) {
    case 'right':  return { x: rect.right, y: rect.top + rect.height / 2 };
    case 'left':   return { x: rect.left,  y: rect.top + rect.height / 2 };
    case 'top':    return { x: rect.left + rect.width / 2, y: rect.top };
    case 'bottom': return { x: rect.left + rect.width / 2, y: rect.bottom };
  }
}

/**
 * Pick the edge of `fromRect` that faces `toRect` (or vice versa).
 * Uses the relative angle: if the other rect is mostly to the left/right
 * of this one, return a horizontal edge; otherwise vertical.
 */
function autoEdge(thisRect: DOMRect, otherRect: DOMRect): 'left' | 'right' | 'top' | 'bottom' {
  const thisCx = thisRect.left + thisRect.width / 2;
  const thisCy = thisRect.top + thisRect.height / 2;
  const otherCx = otherRect.left + otherRect.width / 2;
  const otherCy = otherRect.top + otherRect.height / 2;
  const dx = otherCx - thisCx;
  const dy = otherCy - thisCy;
  // Use the larger axis to pick the edge.
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}

export default function ConnectionLines({
  connections,
  containerRef,
  onDelete,
  deleteConfirm,
  zIndex = 1,
}: ConnectionLinesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);

  const updateLines = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      const svg = svgRef.current;
      if (!container || !svg) return;

      const svgRect = svg.getBoundingClientRect();

      // Size SVG to match container's scrollable area
      svg.setAttribute('width', container.scrollWidth.toString());
      svg.setAttribute('height', container.scrollHeight.toString());

      // Remove old lines
      const existing = svg.querySelectorAll('.conn-line, .conn-arrow, .conn-hit');
      existing.forEach(el => el.remove());

      // Theme-aware default color
      const isDark = document.documentElement.classList.contains('dark');
      const defaultColor = isDark ? '#64748b' : '#94a3b8';

      const lines: ComputedLine[] = [];
      for (const conn of connections) {
        const fromEl = container.querySelector(conn.fromSelector) as HTMLElement | null;
        const toEl = container.querySelector(conn.toSelector) as HTMLElement | null;
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        // Same-column: both endpoints share a common ancestor matching the
        // caller's selector. This generalizes the old "same sprint" check
        // for task→task and lets note→anything omit it.
        let sameColumn = false;
        if (conn.commonAncestorSelector) {
          const fromAnc = fromEl.closest(conn.commonAncestorSelector);
          const toAnc = toEl.closest(conn.commonAncestorSelector);
          sameColumn = !!(fromAnc && toAnc && fromAnc === toAnc);
        }

        const fromEdgeRaw = conn.fromEdge ?? 'auto';
        const toEdgeRaw = conn.toEdge ?? 'auto';
        const fromEdge = fromEdgeRaw === 'auto' ? autoEdge(fromRect, toRect) : fromEdgeRaw;
        const toEdge = toEdgeRaw === 'auto' ? autoEdge(toRect, fromRect) : toEdgeRaw;
        const fromPt = edgePoint(fromRect, fromEdge);
        const toPt = edgePoint(toRect, toEdge);

        // Convert viewport coords to SVG-local coords
        const x1 = fromPt.x - svgRect.left;
        const y1 = fromPt.y - svgRect.top;
        const x2 = toPt.x - svgRect.left;
        const y2 = toPt.y - svgRect.top;

        lines.push({
          id: conn.id,
          x1, y1, x2, y2,
          sameColumn,
          color: conn.color ?? defaultColor,
          fromEdge,
          toEdge,
        });
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
          pathD = `M ${p0[0]} ${p0[1]} C ${p1c[0]} ${p1c[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`;
        } else {
          // Control points extend in the direction of each endpoint's edge,
          // so the curve leaves the source and enters the target perpendicular
          // to the chosen edge.
          const dx = line.x2 - line.x1;
          const dy = line.y2 - line.y1;
          const cpOffset = Math.max(Math.sqrt(dx * dx + dy * dy) * 0.4, 50);
          const p0 = [line.x1, line.y1];
          const p1c =
            line.fromEdge === 'right'  ? [line.x1 + cpOffset, line.y1] :
            line.fromEdge === 'left'   ? [line.x1 - cpOffset, line.y1] :
            line.fromEdge === 'bottom' ? [line.x1, line.y1 + cpOffset] :
                                         [line.x1, line.y1 - cpOffset];
          p2 =
            line.toEdge === 'right'    ? [line.x2 + cpOffset, line.y2] :
            line.toEdge === 'left'     ? [line.x2 - cpOffset, line.y2] :
            line.toEdge === 'bottom'   ? [line.x2, line.y2 + cpOffset] :
                                         [line.x2, line.y2 - cpOffset];
          p3 = [line.x2, line.y2];
          pathD = `M ${p0[0]} ${p0[1]} C ${p1c[0]} ${p1c[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`;
        }

        // Main visible path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'conn-line');
        path.setAttribute('d', pathD);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', line.color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '6 3');
        path.setAttribute('opacity', '0.7');
        path.setAttribute('data-conn-id', line.id);
        svg.appendChild(path);

        // Wide invisible hit-area for click-to-delete
        if (onDelete) {
          const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          hitArea.setAttribute('class', 'conn-hit');
          hitArea.setAttribute('d', pathD);
          hitArea.setAttribute('fill', 'none');
          hitArea.setAttribute('stroke', 'transparent');
          hitArea.setAttribute('stroke-width', '12');
          hitArea.setAttribute('data-conn-id', line.id);
          hitArea.style.pointerEvents = 'stroke';
          hitArea.style.cursor = 'pointer';
          hitArea.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (e.currentTarget as SVGElement).getAttribute('data-conn-id');
            if (!id) return;
            if (deleteConfirm && !confirm(deleteConfirm)) return;
            onDelete(id);
          });
          hitArea.addEventListener('mouseenter', () => {
            path.setAttribute('stroke', isDark ? '#3b82f6' : '#2563eb');
            path.setAttribute('stroke-width', '3');
            path.setAttribute('opacity', '1');
          });
          hitArea.addEventListener('mouseleave', () => {
            path.setAttribute('stroke', line.color);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('opacity', '0.7');
          });
          svg.appendChild(hitArea);
        }

        // ─── Arrowhead at the target end ───
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
        arrow.setAttribute('class', 'conn-arrow');
        arrow.setAttribute('points', [
          `${tipX},${tipY}`,
          `${base1X},${base1Y}`,
          `${base2X},${base2Y}`,
        ].join(' '));
        arrow.setAttribute('fill', line.color);
        arrow.setAttribute('opacity', '0.9');
        svg.appendChild(arrow);
      }
    });
  }, [connections, containerRef, onDelete, deleteConfirm]);

  // Recalculate lines on mount, on props change, and on resize / theme / pan
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
      style={{ zIndex }}
    />
  );
}
