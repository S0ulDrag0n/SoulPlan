'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, TaskPriority, ProjectMember } from '@/lib/types';
import * as api from '@/lib/api';

interface TaskDetailPanelProps {
  task: Task | null;
  projectId: string;
  members: ProjectMember[];
  canEdit: boolean;
  onClose: () => void;
  onUpdated: (task: Task) => void;
}

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

export default function TaskDetailPanel({
  task, projectId, members, canEdit, onClose, onUpdated,
}: TaskDetailPanelProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync local state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setAssigneeId(task.assigneeId);
      setPriority(task.priority);
      setEditing(false);
    }
  }, [task?.id]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Click outside to close
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await api.updateTaskDetail(task.id, {
        title,
        description: description || null,
        assigneeId,
        priority,
        projectId,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      console.error('Failed to update task:', err);
    } finally {
      setSaving(false);
    }
  }, [task, title, description, assigneeId, priority, projectId, onUpdated]);

  if (!task) return null;

  const priorityInfo = PRIORITIES.find(p => p.value === task.priority);
  const assignee = members.find(m => m.memberId === task.assigneeId);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col overflow-hidden">
      <div ref={panelRef} className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Task Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Title</label>
            {editing && canEdit ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500"
              />
            ) : (
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">{task.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</label>
            {editing && canEdit ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500 resize-y"
                placeholder="Add a description…"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {task.description || 'No description'}
              </p>
            )}
          </div>

          {/* Assignee */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Assignee</label>
            {editing && canEdit ? (
              <select
                value={assigneeId ?? ''}
                onChange={(e) => setAssigneeId(e.target.value || null)}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.memberId} value={m.memberId}>{m.memberType === 'user' ? 'User' : 'Guest'} ({m.role})</option>
                ))}
              </select>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm text-gray-700 dark:text-gray-200">{assignee ? `${assignee.memberType} (${assignee.role})` : 'Unassigned'}</span>
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Priority</label>
            {editing && canEdit ? (
              <div className="flex gap-2 mt-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      priority === p.value
                        ? 'bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-300 dark:ring-gray-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: priorityInfo?.color }} />
                <span className="text-sm text-gray-700 dark:text-gray-200 capitalize">{task.priority}</span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>Created</span>
              <span>{new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
            {task.updatedAt && (
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>Updated</span>
                <span>{new Date(task.updatedAt).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>Estimate</span>
              <span>{task.estimate} pts</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>Critical</span>
              <span>{task.isCritical ? '⚡ Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        {canEdit ? (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 flex justify-end gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => { setEditing(false); }}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium"
              >
                ✏️ Edit
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}