'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BoardState } from '@/lib/types';
import { fetchBoard } from '@/lib/api';

export function useBoard(boardId?: string) {
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track the latest request so stale responses (from a previous boardId)
  // don't overwrite the current board state. Fixes race condition where
  // the initial fetch(null) resolves after the fetch(projectId) and
  // replaces the correct board with an empty default board.
  const reqIdRef = useRef(0);

  const reload = useCallback(async () => {
    const myReqId = ++reqIdRef.current;
    try {
      // Only show loading spinner on initial load (no boardState yet).
      // Subsequent reloads after mutations use optimistic updates,
      // so we silently refresh without the flash.
      if (!boardState) setLoading(true);
      setError(null);
      const data = await fetchBoard(boardId);
      if (reqIdRef.current !== myReqId) return; // stale response
      setBoardState(data);
    } catch (err) {
      if (reqIdRef.current !== myReqId) return; // stale response
      setError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      if (reqIdRef.current === myReqId) setLoading(false);
    }
  }, [boardState, boardId]);

  useEffect(() => { reload(); }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { boardState, setBoardState, loading, error, reload };
}