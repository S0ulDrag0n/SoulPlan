'use client';

import { useState, useEffect } from 'react';
import { fetchJiraConfig, createJiraConfig, updateJiraConfig, deleteJiraConfig, testJiraConnection } from '@/lib/api';
import type { JiraConfig } from '@/lib/types';

interface Props {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function JiraConfigDialog({ projectId, isOpen, onClose, onSaved }: Props) {
  const [config, setConfig] = useState<JiraConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [jiraType, setJiraType] = useState<'cloud' | 'server'>('cloud');
  const [boardId, setBoardId] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchJiraConfig(projectId).then(c => {
      if ('configured' in c && c.configured === false) {
        setConfig(null);
      } else {
        const cfg = c as JiraConfig;
        setConfig(cfg);
        setBaseUrl(cfg.baseUrl);
        setEmail(cfg.email ?? '');
        setJiraType(cfg.jiraType);
        setBoardId(cfg.boardId ?? '');
        setAutoSync(cfg.autoSync);
      }
    }).finally(() => setLoading(false));
  }, [projectId, isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testJiraConnection(projectId, { baseUrl, email: email || null, apiToken, jiraType });
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config) {
        await updateJiraConfig(projectId, {
          baseUrl, email: email || null, jiraType,
          boardId: boardId || null, autoSync,
          ...(apiToken ? { apiToken } : {}),
        });
      } else {
        await createJiraConfig(projectId, {
          baseUrl, jiraType, email: email || null,
          apiToken: apiToken || null, boardId: boardId || null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert('Failed to save: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Remove Jira integration?')) return;
    await deleteJiraConfig(projectId);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Jira Configuration</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Loading…</div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Jira Type</label>
                <select
                  value={jiraType}
                  onChange={e => setJiraType(e.target.value as 'cloud' | 'server')}
                  className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                >
                  <option value="cloud">Cloud</option>
                  <option value="server">Server / Data Center</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Base URL</label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder="https://your-domain.atlassian.net"
                  className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                />
              </div>

              {jiraType === 'cloud' && (
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  API Token {config && '(leave blank to keep existing)'}
                </label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Board ID (optional)</label>
                <input
                  type="text"
                  value={boardId}
                  onChange={e => setBoardId(e.target.value)}
                  placeholder="e.g. 42"
                  className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                />
              </div>

              {config && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={autoSync} onChange={e => setAutoSync(e.target.checked)} />
                  Auto-sync every 5 minutes
                </label>
              )}
            </div>

            {testResult && (
              <div className={`text-sm p-2 rounded ${testResult.ok ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                {testResult.ok ? '✓ Connection successful' : `✗ ${testResult.error ?? 'Connection failed'}`}
              </div>
            )}

            <div className="flex items-center gap-2 justify-between">
              <div className="flex gap-2">
                <button
                  onClick={handleTest}
                  disabled={testing || !baseUrl || !apiToken}
                  className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  {testing ? 'Testing…' : 'Test Connection'}
                </button>
              </div>
              <div className="flex gap-2">
                {config && (
                  <button onClick={handleDelete} className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700">
                    Remove
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !baseUrl}
                  className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}