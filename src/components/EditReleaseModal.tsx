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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Edit Release</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Name</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Target Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 mt-1"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Notes</label>
            <textarea
              className="w-full border rounded px-3 py-2 mt-1"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => onSave(release.id, {
              name: name || undefined,
              targetDate: targetDate || null,
              notes: notes || null,
            })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}