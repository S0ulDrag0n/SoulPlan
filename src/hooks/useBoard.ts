'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BoardState } from '@/lib/types';
import { fetchBoard } from '@/lib/api';

export function useBoard(boardId?: string) {
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      // Only show loading spinner on initial load (no boardState yet).
      // Subsequent reloads after mutations use optimistic updates,
      // so we silently refresh without the flash.
      if (!boardState) setLoading(true);
      setError(null);
      const data = await fetchBoard(boardId);
      setBoardState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [boardState, boardId]);

  useEffect(() => { reload(); }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { boardState, setBoardState, loading, error, reload };
}