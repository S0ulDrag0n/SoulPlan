'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BoardState } from '@/lib/types';
import { fetchBoard } from '@/lib/api';

export function useBoard() {
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBoard();
      setBoardState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { boardState, loading, error, reload };
}