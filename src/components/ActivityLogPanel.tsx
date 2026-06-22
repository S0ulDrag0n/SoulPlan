'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActivityLogEntry } from '@/lib/types';

interface ActivityLogPanelProps {
  projectId: string;
  onClose: () => void;
}

const ENTITY_ICONS: Record<string, string> = {
  task: '📋',
  sprint: '🏃',
  release: '📦',
  note: '📝',
  dependency: '🔗',
  project: '📁',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityLogPanel({ projectId, onClose }: ActivityLogPanelProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const newOffset = reset ? 0 : offset;
    try {
      const res = await fetch(`/api/projects/${projectId}/activity?limit=50&offset=${newOffset}`);
      const data = await res.json();
      const newEntries: ActivityLogEntry[] = data.entries ?? [];
      if (reset) {
        setEntries(newEntries);
      } else {
        setEntries(prev => [...prev, ...newEntries]);
      }
      setHasMore(newEntries.length === 50);
      setOffset(newOffset + newEntries.length);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, offset]);

  useEffect(() => { load(true); }, []);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">🔔 Activity Log</h3>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-lg">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-gray-400 dark:text-gray-500 text-sm">No activity yet</div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 py-2 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-lg shrink-0">{ENTITY_ICONS[entry.entityType] ?? '•'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    <span className="font-medium capitalize">{entry.action}</span>{' '}
                    <span className="text-gray-500 dark:text-gray-400">{entry.entityType}</span>
                    {entry.entityName ? <span className="text-gray-600 dark:text-gray-300">: {entry.entityName}</span> : null}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {entry.memberId ? `${entry.memberId.slice(0, 8)}…` : 'system'} · {timeAgo(entry.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasMore && entries.length > 0 ? (
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
      </div>
    </div>
  );
}