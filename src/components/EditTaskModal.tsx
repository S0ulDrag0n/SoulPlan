'use client';

import { useState } from 'react';
import type { Task } from '@/lib/types';

interface EditTaskModalProps {
  task: Task;
  onSave: (task: Task) => void;
  onClose: () => void;
}

export default function EditTaskModal({ task, onSave, onClose }: EditTaskModalProps) {
  const [form, setForm] = useState<Task>(task);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
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
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
}