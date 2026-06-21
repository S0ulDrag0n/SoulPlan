'use client';

import { useState, useRef, useEffect } from 'react';
import type { BoardState } from '@/lib/types';

interface BoardTitleProps {
  boardState: BoardState;
  isOwner: boolean;
  onRename: (name: string) => Promise<void>;
}

export default function BoardTitle({ boardState, isOwner, onRename }: BoardTitleProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(boardState.board.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local name when board state changes externally (e.g., realtime reload)
  useEffect(() => {
    if (!editing) setName(boardState.board.name);
  }, [boardState.board.name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Compute stats from board state
  const releases = boardState.releases;
  const sprints = releases.reduce((sum, r) => sum + r.sprints.length, 0);
  const tasks = releases.reduce(
    (sum, r) => sum + r.sprints.reduce((s, sp) => s + sp.tasks.length, 0),
    0
  );
  const totalPoints = releases.reduce(
    (sum, r) => sum + r.sprints.reduce(
      (s, sp) => s + sp.tasks.reduce((t, task) => t + (task.estimate || 0), 0),
      0
    ),
    0
  );

  const stats = [
    releases.length !== 0 && `${releases.length} release${releases.length !== 1 ? 's' : ''}`,
    sprints !== 0 && `${sprints} sprint${sprints !== 1 ? 's' : ''}`,
    tasks !== 0 && `${tasks} task${tasks !== 1 ? 's' : ''}`,
    totalPoints !== 0 && `${totalPoints} pts`,
  ].filter(Boolean).join(' · ');

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === boardState.board.name) {
      setName(boardState.board.name);
      setEditing(false);
      return;
    }
    try {
      await onRename(trimmed);
      setName(trimmed);
    } catch {
      setName(boardState.board.name);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setName(boardState.board.name);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="text-2xl font-bold text-gray-800 dark:text-gray-100 bg-transparent border-b-2 border-blue-400 outline-none max-w-xs"
        />
        {stats && <span className="text-xs text-gray-400 dark:text-gray-500">{stats}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {boardState.board.name}
        </h1>
        {isOwner && (
          <button
            onClick={() => setEditing(true)}
            className="text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
            title="Rename board"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM2 10l8-8 6 6-8 8H2v-6z" transform="translate(-1 -1)" />
            </svg>
          </button>
        )}
      </div>
      {stats && <span className="text-xs text-gray-400 dark:text-gray-500">{stats}</span>}
    </div>
  );
}