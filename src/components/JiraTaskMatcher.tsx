'use client';

import { useState, useEffect } from 'react';
import { searchJiraEpics, fetchEpicIssues, linkJiraEntity } from '@/lib/api';
import type { JiraIssue } from '@/lib/types';

interface Props {
  projectId: string;
  taskId: string;
  taskTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onLinked: () => void;
}

export function JiraTaskMatcher({ projectId, taskId, taskTitle, isOpen, onClose, onLinked }: Props) {
  const [epics, setEpics] = useState<JiraIssue[]>([]);
  const [selectedEpic, setSelectedEpic] = useState<string | null>(null);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    searchJiraEpics(projectId)
      .then(setEpics)
      .catch(() => setEpics([]))
      .finally(() => setLoading(false));
  }, [projectId, isOpen]);

  useEffect(() => {
    if (!selectedEpic) {
      setIssues([]);
      return;
    }
    fetchEpicIssues(projectId, selectedEpic).then(setIssues).catch(() => setIssues([]));
  }, [projectId, selectedEpic]);

  if (!isOpen) return null;

  const handleLink = async (issue: JiraIssue) => {
    setLinking(issue.id);
    try {
      await linkJiraEntity(projectId, {
        entityType: 'task',
        entityId: taskId,
        jiraId: issue.id,
        jiraKey: issue.key,
        jiraStatus: issue.status,
      });
      onLinked();
      onClose();
    } catch (err) {
      alert('Failed to link: ' + (err as Error).message);
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Link to Jira Issue</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        </div>

        <div className="text-sm text-slate-500">
          Matching task: <span className="font-medium">{taskTitle}</span>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Loading epics…</div>
        ) : epics.length === 0 ? (
          <div className="text-sm text-slate-400">No epics found. Configure Jira first.</div>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Select an Epic</label>
              <select
                value={selectedEpic ?? ''}
                onChange={e => setSelectedEpic(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
              >
                <option value="">Choose an epic…</option>
                {epics.map(epic => (
                  <option key={epic.id} value={epic.key}>{epic.key} — {epic.summary}</option>
                ))}
              </select>
            </div>

            {issues.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">Issues in epic</h3>
                {issues.map(issue => (
                  <div key={issue.id} className="flex items-center justify-between p-2 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{issue.key}</div>
                      <div className="text-xs text-slate-500 truncate">{issue.summary}</div>
                      <div className="text-xs text-slate-400">{issue.status}</div>
                    </div>
                    <button
                      onClick={() => handleLink(issue)}
                      disabled={linking === issue.id}
                      className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {linking === issue.id ? 'Linking…' : 'Link'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}