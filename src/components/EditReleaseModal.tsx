'use client';

import { useState } from 'react';
import type { Release } from '@/lib/types';

interface EditReleaseModalProps {
  release: Release;
  onSave: (id: string, data: { name?: string; targetDate?: string | null; notes?: string | null }) => void;
  onClose: () => void;
}

export default function EditReleaseModal({ release, onSave, onClose }: EditReleaseModalProps) {
  const [name, setName] = useState(release.name);
  const [targetDate, setTargetDate] = useState(release.targetDate ?? '');
  const [notes, setNotes] = useState(release.notes ?? '');

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Edit Release</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date</label>
            <input
              type="date"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 h-20 resize-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Cancel</button>
          <button
            onClick={() => onSave(release.id, { name: name || undefined, targetDate: targetDate || null, notes: notes || null })}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}