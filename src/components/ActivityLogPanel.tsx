'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActivityLogEntry } from '@/lib/types';
import { authHeaders } from '@/lib/api';
import { Icon, type IconName } from './Icon';

interface ActivityLogPanelProps {
  projectId: string;
  onClose: () => void;
}

const ENTITY_ICONS: Record<string, IconName> = {
  task: 'clipboard',
  sprint: 'running',
  release: 'package',
  note: 'note',
  dependency: 'link',
  project: 'folder',
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
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (reset: boolean) => {
    setLoading(true);
    try {
      const o = reset ? 0 : offset;
      const res = await fetch(`/api/projects/${projectId}/activity?offset=${o}&limit=30`, {
        headers: { ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const newEntries = reset ? data.entries : [...entries, ...data.entries];
      setEntries(newEntries);
      setHasMore(data.hasMore);
      setOffset(o + data.entries.length);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, offset, entries]);

  useEffect(() => { load(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Icon name="bell" className="w-4 h-4" /> Activity Log
        </h3>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Close">
          <Icon name="close" className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-gray-400 dark:text-gray-500 text-sm">Loading\u2026</div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-gray-400 dark:text-gray-500 text-sm">No activity yet</div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const iconName = ENTITY_ICONS[entry.entityType] ?? 'note';
              return (
                <li key={entry.id} className="flex items-start gap-2 py-2 border-b border-gray-100 dark:border-gray-700/50">
                  <span className="shrink-0 text-gray-400 dark:text-gray-500"><Icon name={iconName} className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      <span className="font-medium capitalize">{entry.action}</span>{' '}
                      <span className="text-gray-500 dark:text-gray-400">{entry.entityType}</span>
                      {entry.entityName ? <span className="text-gray-600 dark:text-gray-300">: {entry.entityName}</span> : null}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {entry.memberId ? `${entry.memberId.slice(0, 8)}\u2026` : 'system'} \u00b7 {timeAgo(entry.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && entries.length > 0 ? (
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            {loading ? 'Loading\u2026' : 'Load more'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
