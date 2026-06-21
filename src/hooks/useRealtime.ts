'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@/lib/types';

export interface RemoteCursor {
  memberId: string;
  memberName: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface PresenceMember {
  memberId: string;
  memberName: string;
}

export interface EditingIndicator {
  memberId: string;
  memberName: string;
  target: 'task' | 'sprint' | 'release';
  targetId: string;
  timestamp: number;
}

export interface UseRealtimeOptions {
  /** Called when a `board-update` event arrives (e.g. a collaborator mutated the board). */
  onBoardUpdate?: (change: string) => void;
}

/**
 * useRealtime — connects to SSE endpoint for a project, tracks cursors,
 * presence, and editing indicators.
 */
export function useRealtime(
  projectId: string | null,
  session: Session | null,
  options?: UseRealtimeOptions,
) {
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [presence, setPresence] = useState<PresenceMember[]>([]);
  const [editing, setEditing] = useState<Map<string, EditingIndicator>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const cursorThrottleRef = useRef<number | null>(null);

  // Keep the latest onBoardUpdate callback in a ref so the SSE effect
  // (which only re-runs on projectId/session change) always calls the
  // freshest version without re-subscribing to the EventSource.
  const onBoardUpdateRef = useRef(options?.onBoardUpdate);
  onBoardUpdateRef.current = options?.onBoardUpdate;

  // Connect to SSE
  useEffect(() => {
    if (!projectId || !session) return;

    // Use the token from the session object, NOT from localStorage.
    // localStorage is shared across tabs — if a guest joins in another tab,
    // it overwrites the token, causing this tab to connect with the wrong
    // identity (the guest's memberId) and cursors get filtered out.
    const token = session.token;
    if (!token) return;

    // EventSource doesn't support custom headers, so pass token as query param
    const url = `/api/realtime/events?projectId=${encodeURIComponent(projectId)}&token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'cursor') {
          setCursors((prev) => {
            const next = new Map(prev);
            next.set(data.memberId, {
              memberId: data.memberId,
              memberName: data.memberName,
              x: data.x,
              y: data.y,
              timestamp: Date.now(),
            });
            return next;
          });
        } else if (data.type === 'presence') {
          if (data.action === 'join') {
            setPresence((prev) => {
              if (prev.some(m => m.memberId === data.memberId)) return prev;
              return [...prev, { memberId: data.memberId, memberName: data.memberName }];
            });
          } else {
            setPresence((prev) => prev.filter(m => m.memberId !== data.memberId));
            // Also remove their cursor
            setCursors((prev) => {
              const next = new Map(prev);
              next.delete(data.memberId);
              return next;
            });
          }
        } else if (data.type === 'presence-list') {
          setPresence(data.members.map((m: { memberId: string; memberName: string }) => ({
            memberId: m.memberId,
            memberName: m.memberName ?? m.memberId,
          })));
        } else if (data.type === 'editing') {
          setEditing((prev) => {
            const next = new Map(prev);
            next.set(data.memberId, {
              memberId: data.memberId,
              memberName: data.memberName,
              target: data.target,
              targetId: data.targetId,
              timestamp: Date.now(),
            });
            return next;
          });
        } else if (data.type === 'board-update') {
          onBoardUpdateRef.current?.(data.change);
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.addEventListener('message', handleMessage);
    es.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [projectId, session]);

  // Clean up stale cursors (no update in 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [key, cursor] of next) {
          if (now - cursor.timestamp > 10000) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      // Clean up stale editing indicators (30 seconds)
      setEditing((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [key, ind] of next) {
          if (now - ind.timestamp > 30000) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Send cursor position (throttled to ~50ms)
  const sendCursor = useCallback((x: number, y: number) => {
    if (!projectId || !session) return;
    if (cursorThrottleRef.current) return; // Skip if a send is pending

    cursorThrottleRef.current = window.setTimeout(() => {
      cursorThrottleRef.current = null;
      fetch('/api/realtime/cursor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ projectId, x, y }),
      }).catch(() => { /* ignore errors */ });
    }, 50);
  }, [projectId, session]);

  // Send editing indicator
  const sendEditing = useCallback((target: 'task' | 'sprint' | 'release', targetId: string) => {
    if (!projectId || !session) return;
    fetch('/api/realtime/editing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ projectId, target, targetId }),
    }).catch(() => { /* ignore errors */ });
  }, [projectId, session]);

  return { cursors, presence, editing, sendCursor, sendEditing };
}