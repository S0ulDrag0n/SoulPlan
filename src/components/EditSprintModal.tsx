'use client';

import { useState } from 'react';
import type { Sprint } from '@/lib/types';

interface EditSprintModalProps {
  sprint: Sprint;
  onSave: (id: string, data: {
    name?: string;
    capacity?: number;
    capacityUnit?: string;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
  }) => void;
  onClose: () => void;
}

export default function EditSprintModal({ sprint, onSave, onClose }: EditSprintModalProps) {
  const [name, setName] = useState(sprint.name);
  const [capacity, setCapacity] = useState(sprint.capacity);
  const [startDate, setStartDate] = useState(sprint.startDate ?? '');
  const [endDate, setEndDate] = useState(sprint.endDate ?? '');
  const [notes, setNotes] = useState(sprint.notes ?? '');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Edit Sprint</h3>
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
            <label className="text-sm text-gray-600">Capacity (points)</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2 mt-1"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Start Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 mt-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">End Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 mt-1"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
            onClick={() => onSave(sprint.id, {
              name: name || undefined,
              capacity: capacity || 0,
              startDate: startDate || null,
              endDate: endDate || null,
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