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
  const [capacityUnit, setCapacityUnit] = useState(sprint.capacityUnit);
  const [startDate, setStartDate] = useState(sprint.startDate ?? '');
  const [endDate, setEndDate] = useState(sprint.endDate ?? '');
  const [notes, setNotes] = useState(sprint.notes ?? '');

  // Validate date range on change
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate && val > endDate) {
      setEndDate(val);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Edit Sprint</h3>

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

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity</label>
              <input
                type="number"
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value))}
                min={0}
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={capacityUnit}
                onChange={e => setCapacityUnit(e.target.value)}
              >
                <option value="pts">pts</option>
                <option value="hrs">hrs</option>
                <option value="days">days</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={startDate}
                onChange={e => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
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
            onClick={() => onSave(sprint.id, {
              name: name || undefined,
              capacity: capacity || undefined,
              capacityUnit: capacityUnit || undefined,
              startDate: startDate || null,
              endDate: endDate || null,
              notes: notes || null,
            })}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}