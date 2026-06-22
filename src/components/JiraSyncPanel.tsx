'use client';

import { useState, useEffect } from 'react';
import { runJiraSync, fetchSyncLogs } from '@/lib/api';
import type { JiraSyncLog } from '@/lib/types';

interface Props {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function JiraSyncPanel({ projectId, isOpen, onClose }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ imported: number; exported: number; skipped: number; errors: number } | null>(null);
  const [logs, setLogs] = useState<JiraSyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingLogs(true);
    fetchSyncLogs(projectId).then(setLogs).finally(() => setLoadingLogs(false));
  }, [projectId, isOpen]);

  if (!isOpen) return null;

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await runJiraSync(projectId);
      setSyncResult(result);
      const freshLogs = await fetchSyncLogs(projectId);
      setLogs(freshLogs);
    } catch (err) {
      alert('Sync failed: ' + (err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const iconFor = (action: string) => {
    switch (action) {
      case 'created': return '✨';
      case 'updated': return '🔄';
      case 'skipped': return '⏭️';
      case 'error': return '❌';
      default: return '•';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Jira Sync</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>

        {syncResult && (
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div className="bg-green-100 dark:bg-green-900/30 rounded p-2">
              <div className="font-bold text-green-700 dark:text-green-300">{syncResult.imported}</div>
              <div className="text-xs text-slate-500">Imported</div>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded p-2">
              <div className="font-bold text-blue-700 dark:text-blue-300">{syncResult.exported}</div>
              <div className="text-xs text-slate-500">Exported</div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-700 rounded p-2">
              <div className="font-bold text-slate-600 dark:text-slate-300">{syncResult.skipped}</div>
              <div className="text-xs text-slate-500">Skipped</div>
            </div>
            <div className="bg-red-100 dark:bg-red-900/30 rounded p-2">
              <div className="font-bold text-red-700 dark:text-red-300">{syncResult.errors}</div>
              <div className="text-xs text-slate-500">Errors</div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Sync History</h3>
          {loadingLogs ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-slate-400">No sync activity yet</div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-2 text-sm py-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <span>{iconFor(log.action)}</span>
                  <div className="flex-1">
                    <span className="text-slate-600 dark:text-slate-300">
                      {log.direction} {log.entityType}
                      {log.entityId ? ` ${log.entityId.slice(0, 8)}` : ''}
                      {log.jiraId ? ` → ${log.jiraId}` : ''}
                    </span>
                    {log.details && (
                      <div className="text-xs text-slate-400">{log.details}</div>
                    )}
                    <div className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}