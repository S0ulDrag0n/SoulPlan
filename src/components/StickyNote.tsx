'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { StickyNote as StickyNoteModel } from '@/lib/types';

interface StickyNoteProps {
  note: StickyNoteModel;
  onMove: (id: string, x: number, y: number) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onColorCycle: (id: string) => void;
  /** Called when user starts drag-to-connect from the connector handle. */
  onConnectionDragStart: (
    noteId: string,
    handleEl: HTMLElement
  ) => void;
}

const COLORS = [
  { name: 'yellow', bg: 'bg-yellow-200', border: 'border-yellow-300' },
  { name: 'pink', bg: 'bg-pink-200', border: 'border-pink-300' },
  { name: 'blue', bg: 'bg-blue-200', border: 'border-blue-300' },
  { name: 'green', bg: 'bg-green-200', border: 'border-green-300' },
  { name: 'purple', bg: 'bg-purple-200', border: 'border-purple-300' },
] as const;

const NOTE_WIDTH = 200;
const NOTE_MIN_HEIGHT = 80;

export default function StickyNote({
  note,
  onMove,
  onTextChange,
  onDelete,
  onColorCycle,
  onConnectionDragStart,
}: StickyNoteProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [dragging, setDragging] = useState(false);

  const textRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, noteX: 0, noteY: 0 });
  const colorClass = COLORS.find(c => c.name === note.color) ?? COLORS[0];

  // Keep local text in sync when the note is updated externally
  // (e.g. after a save roundtrip). Skip while editing to avoid clobbering.
  useEffect(() => {
    if (!editing) setText(note.text);
  }, [note.text, editing]);

  // On edit-mode entry, sync the DOM text node to the current `text` state.
  // We don't render React-managed text as children during edit (see JSX
  // below) — so the DOM owns the content while editing — but we still need
  // to seed the editable area with the previously-saved text when the user
  // double-clicks an existing note. This effect runs once on the false→true
  // transition, which is exactly what we want.
  useEffect(() => {
    if (editing && textRef.current) {
      // Only seed if the DOM is empty or stale (e.g. just entered edit mode).
      // We rely on this effect being gated on the editing transition; once
      // the user is typing, we don't want to clobber their cursor position.
      textRef.current.textContent = text;
    }
    // Intentionally only re-run when `editing` flips. The `text` read inside
    // captures the value at the moment of the transition; subsequent typing
    // updates the DOM directly via the browser's input handling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // ── Drag-to-move (header only) ───────────────────────────
  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only left-button initiates drag. Middle-button and space+left
      // bubble up to PanCanvas.
      if (e.button !== 0) return;
      // Don't drag if the user is interacting with the connector handle
      // (it's positioned inside the header on the right edge).
      const target = e.target as HTMLElement;
      if (target.closest('[data-connector-handle]')) return;

      e.stopPropagation(); // Prevent PanCanvas from also receiving this
      e.preventDefault();
      setDragging(true);
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        noteX: note.x,
        noteY: note.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [note.x, note.y]
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      // The note lives inside a `transform: translate(...)` panned layer, so
      // the cursor's clientX/Y is in viewport coords but the note's (x, y)
      // is in pan-space. Because the parent's transform doesn't change while
      // we're dragging a note, the delta translates 1:1 — the note stays
      // under the cursor regardless of pan offset.
      const newX = dragStartRef.current.noteX + dx;
      const newY = dragStartRef.current.noteY + dy;
      onMove(note.id, newX, newY);
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, note.id, onMove]);

  // ── Double-click → edit ─────────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    // Focus + select all on next tick
    setTimeout(() => {
      const el = textRef.current;
      if (el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);
  }, []);

  const handleTextBlur = useCallback(() => {
    setEditing(false);
    if (text !== note.text) {
      onTextChange(note.id, text);
    }
  }, [text, note.text, note.id, onTextChange]);

  const handleTextKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel: revert and exit
        setText(note.text);
        setEditing(false);
        (e.currentTarget as HTMLElement).blur();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // Plain Enter exits edit; Shift+Enter inserts newline
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
      }
    },
    [note.text]
  );

  // ── Shift+click on header → cycle color ─────────────────
  const handleHeaderClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        e.stopPropagation();
        onColorCycle(note.id);
      }
    },
    [note.id, onColorCycle]
  );

  // ── Connector handle (right edge) ───────────────────────
  const handleConnectorDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const handleEl = e.currentTarget as HTMLElement;
      onConnectionDragStart(note.id, handleEl);
    },
    [note.id, onConnectionDragStart]
  );

  return (
    <div
      data-sticky-id={note.id}
      className={`absolute ${colorClass.bg} ${colorClass.border} border rounded-lg shadow-md select-none transition-shadow ${
        dragging ? 'shadow-xl cursor-grabbing' : 'hover:shadow-lg'
      }`}
      style={{
        left: note.x,
        top: note.y,
        width: NOTE_WIDTH,
        minHeight: NOTE_MIN_HEIGHT,
        zIndex: note.z + 100, // Sit above sprint columns
        // While dragging, disable transitions for instant feedback
        transition: dragging ? 'none' : undefined,
      }}
    >
      {/* Header — drag handle for moving the note */}
      <div
        className="px-2 py-1 flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-lg"
        onPointerDown={handleHeaderPointerDown}
        onClick={handleHeaderClick}
        title="Drag to move · Shift+click to change color · Double-click body to edit"
      >
        <span className="text-[10px] text-gray-600/70 font-medium">note</span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this sticky note?')) onDelete(note.id);
            }}
            className="text-gray-500 hover:text-red-600 text-xs leading-none"
            title="Delete note"
            // Prevent the header drag handler from firing
            onPointerDown={(e) => e.stopPropagation()}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body — editable text.

          While editing, the DOM owns the text content (the browser inserts
          characters at the caret). Rendering React-managed text as children
          during edit causes React to re-set the text node's `nodeValue` on
          every input event, which collapses the caret back to position 0 —
          making new characters insert at the start of the text and visibly
          REVERSE the user's typing. We sidestep this by rendering `null`
          as children while editing; the placeholder/note-text only renders
          when editing is off. */}
      <div
        ref={textRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onDoubleClick={handleDoubleClick}
        onBlur={handleTextBlur}
        onKeyDown={handleTextKeyDown}
        onInput={(e) => setText((e.target as HTMLDivElement).textContent ?? '')}
        className={`px-3 pb-3 pt-1 text-sm text-gray-800 whitespace-pre-wrap break-words outline-none ${
          editing ? 'cursor-text' : 'cursor-default'
        }`}
        style={{ minHeight: NOTE_MIN_HEIGHT - 30 }}
      >
        {editing ? null : (text || <span className="text-gray-500/60 italic">Double-click to edit</span>)}
      </div>

      {/* Connector handle — right-edge dot for creating connections */}
      <div
        data-connector-handle
        onPointerDown={handleConnectorDown}
        className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow cursor-crosshair hover:scale-125 transition-transform"
        title="Drag to a task, sprint, or release to connect"
      />
    </div>
  );
}
