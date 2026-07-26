'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { StickyNote as StickyNoteModel } from '@/lib/types';

interface StickyNoteProps {
  note: StickyNoteModel;
  onMove: (id: string, x: number, y: number) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onColorCycle: (id: string) => void;
  onConnectionDragStart: (noteId: string, handleEl: HTMLElement) => void;
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

export default function StickyNote({ note, onMove, onTextChange, onDelete, onColorCycle, onConnectionDragStart }: StickyNoteProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [dragging, setDragging] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, noteX: 0, noteY: 0 });
  const colorClass = COLORS.find(c => c.name === note.color) ?? COLORS[0];

  useEffect(() => { if (!editing) setText(note.text); }, [note.text, editing]);
  useEffect(() => { if (editing && textRef.current) textRef.current.textContent = text; }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-connector-handle]')) return;
    e.stopPropagation(); e.preventDefault();
    setDragging(true);
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, noteX: note.x, noteY: note.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [note.x, note.y]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      onMove(note.id, dragStartRef.current.noteX + dx, dragStartRef.current.noteY + dy);
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
  }, [dragging, note.id, onMove]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); setEditing(true);
    setTimeout(() => {
      const el = textRef.current;
      if (el) { el.focus(); const range = document.createRange(); range.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range); }
    }, 0);
  }, []);

  const handleTextBlur = useCallback(() => { setEditing(false); if (text !== note.text) onTextChange(note.id, text); }, [text, note.text, note.id, onTextChange]);
  const handleTextKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setText(note.text); setEditing(false); (e.currentTarget as HTMLElement).blur(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
  }, [note.text]);

  const handleHeaderClick = useCallback((e: React.MouseEvent) => { if (e.shiftKey) { e.stopPropagation(); onColorCycle(note.id); } }, [note.id, onColorCycle]);
  const handleConnectorDown = useCallback((e: React.PointerEvent) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onConnectionDragStart(note.id, e.currentTarget as HTMLElement); }, [note.id, onConnectionDragStart]);

  return (
    <div data-sticky-id={note.id}
      className={`absolute ${colorClass.bg} ${colorClass.border} border rounded-lg select-none transition-all ${dragging ? 'shadow-xl cursor-grabbing' : 'hover:shadow-lg hover:rotate-[1deg]'}`}
      style={{ left: note.x, top: note.y, width: NOTE_WIDTH, minHeight: NOTE_MIN_HEIGHT, zIndex: note.z + 100, transition: dragging ? 'none' : 'transform 0.15s ease, box-shadow 0.15s ease', boxShadow: dragging ? '0 10px 30px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)' }}>
      <div className="px-2 py-1 flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-lg" onPointerDown={handleHeaderPointerDown} onClick={handleHeaderClick} title="Drag to move · Shift+click to change color · Double-click body to edit">
        <span className="text-[10px] text-gray-600/70 font-medium">note</span>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this sticky note?')) onDelete(note.id); }} className="text-gray-500 hover:text-red-600 text-xs leading-none" title="Delete note" onPointerDown={(e) => e.stopPropagation()}>✕</button>
      </div>
      <div ref={textRef} contentEditable={editing} suppressContentEditableWarning onDoubleClick={handleDoubleClick} onBlur={handleTextBlur} onKeyDown={handleTextKeyDown} onInput={(e) => setText((e.target as HTMLDivElement).textContent ?? '')} className={`px-3 pb-3 pt-1 text-sm text-gray-800 whitespace-pre-wrap break-words outline-none ${editing ? 'cursor-text' : 'cursor-default'}`} style={{ minHeight: NOTE_MIN_HEIGHT - 30 }}>
        {editing ? null : (text || <span className="text-gray-500/60 italic">Double-click to edit</span>)}
      </div>
      <div data-connector-handle onPointerDown={handleConnectorDown} className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-crosshair hover:scale-125 hover:bg-blue-600 transition-all" title="Drag to a task, sprint, or release to connect" />
    </div>
  );
}
