'use client';

import { useState } from 'react';
import type { BoardState, Dependency, Task } from '@/lib/types';
import * as api from '@/lib/api';

interface EditTaskModalProps {
  task: Task;
  boardState: BoardState;
  onSave: (task: Task) => void;
  onClose: () => void;
}

export default function EditTaskModal({ task, boardState, onSave, onClose }: EditTaskModalProps) {
  const [form, setForm] = useState<Task>(task);
  const [depFromId, setDepFromId] = useState('');
  const [depToId, setDepToId] = useState('');
  const [saving, setSaving] = useState(false);

  // Get all tasks across the board for dependency selection
  const allTasks = boardState.releases.flatMap(r => r.sprints.flatMap(s => s.tasks));
  const otherTasks = allTasks.filter(t => t.id !== task.id);

  // Dependencies involving this task
  const blockingDeps = boardState.dependencies.filter(d => d.fromTaskId === task.id);
  const blockedByDeps = boardState.dependencies.filter(d => d.toTaskId === task.id);

  const handleAddDependency = async () => {
    if (!depToId) return;
    setSaving(true);
    try {
      await api.createDependency(task.id, depToId);
      setDepToId('');
      // Trigger board refresh via parent
      onSave(form);
    } catch {
      // Error handling could be improved
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlockedBy = async () => {
    if (!depFromId) return;
    setSaving(true);
    try {
      await api.createDependency(depFromId, task.id);
      setDepFromId('');
      onSave(form);
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDependency = async (depId: string) => {
    setSaving(true);
    try {
      await api.deleteDependency(depId);
      onSave(form);
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  // Helper to get task title by id
  const taskTitle = (id: string) => {
    const t = allTasks.find(t => t.id === id);
    return t ? t.title : id.slice(0, 8);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-[500px] max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Edit Task</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Title</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Estimate (points)</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2 mt-1"
              value={form.estimate}
              onChange={(e) => setForm({ ...form, estimate: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Color</label>
            <input
              type="color"
              className="w-full h-10 rounded mt-1"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isCritical}
              onChange={(e) => setForm({ ...form, isCritical: e.target.checked })}
            />
            <label className="text-sm text-gray-600">Critical</label>
          </div>
          <div>
            <label className="text-sm text-gray-600">Description</label>
            <textarea
              className="w-full border rounded px-3 py-2 mt-1"
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* ─── Dependencies section ──────────────────────── */}
          <div className="border-t pt-3 mt-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Dependencies</h4>

            {/* Blocked by (others block this task) */}
            {blockedByDeps.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-gray-500">Blocked by:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {blockedByDeps.map(dep => (
                    <span key={dep.id} className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                      {taskTitle(dep.fromTaskId)}
                      <button
                        onClick={() => handleRemoveDependency(dep.id)}
                        className="text-orange-400 hover:text-orange-600 ml-0.5"
                        title="Remove dependency"
                      >×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Blocking (this task blocks others) */}
            {blockingDeps.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-gray-500">Blocks:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {blockingDeps.map(dep => (
                    <span key={dep.id} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {taskTitle(dep.toTaskId)}
                      <button
                        onClick={() => handleRemoveDependency(dep.id)}
                        className="text-blue-400 hover:text-blue-600 ml-0.5"
                        title="Remove dependency"
                      >×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {blockedByDeps.length === 0 && blockingDeps.length === 0 && (
              <p className="text-xs text-gray-400 mb-2">No dependencies</p>
            )}

            {/* Add new: "This task blocks..." */}
            <div className="flex items-center gap-2 mt-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">Blocks →</label>
              <select
                className="flex-1 border rounded px-2 py-1 text-sm"
                value={depToId}
                onChange={(e) => setDepToId(e.target.value)}
              >
                <option value="">Select task...</option>
                {otherTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <button
                onClick={handleAddDependency}
                disabled={!depToId || saving}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>

            {/* Add new: "This task is blocked by..." */}
            <div className="flex items-center gap-2 mt-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">← Blocked by</label>
              <select
                className="flex-1 border rounded px-2 py-1 text-sm"
                value={depFromId}
                onChange={(e) => setDepFromId(e.target.value)}
              >
                <option value="">Select task...</option>
                {otherTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <button
                onClick={handleAddBlockedBy}
                disabled={!depFromId || saving}
                className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
}