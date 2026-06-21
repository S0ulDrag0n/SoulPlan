'use client';

import type { TaskFilter } from '@/lib/types';

interface FilterBarProps {
  filter: TaskFilter | null;
  onChange: (filter: TaskFilter | null) => void;
  sprints: { id: string; name: string }[];
}

const STATUS_OPTIONS: { value: 'todo' | 'in-progress' | 'done'; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

export default function FilterBar({ filter, onChange, sprints }: FilterBarProps) {
  const hasFilter = filter !== null;

  const update = (patch: Partial<TaskFilter>) => {
    const next = { ...(filter ?? {}), ...patch };
    // Remove null-ish values to keep the filter object clean
    const cleaned: TaskFilter = {};
    if (next.status) cleaned.status = next.status;
    if (next.sprintId) cleaned.sprintId = next.sprintId;
    if (next.hasJira !== undefined) cleaned.hasJira = next.hasJira;
    onChange(Object.keys(cleaned).length > 0 ? cleaned : null);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Status filter */}
      <select
        value={filter?.status ?? ''}
        onChange={(e) => update({ status: (e.target.value || undefined) as TaskFilter['status'] })}
        className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Sprint filter */}
      <select
        value={filter?.sprintId ?? ''}
        onChange={(e) => update({ sprintId: e.target.value || undefined })}
        className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer"
      >
        <option value="">All sprints</option>
        {sprints.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      {/* Jira toggle — only show if there are tasks with jiraIssueKey */}
      <button
        onClick={() => update({ hasJira: filter?.hasJira ? undefined : true })}
        className={`px-2 py-1.5 text-sm rounded-lg border transition-colors ${
          filter?.hasJira
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-400'
        }`}
        title="Show only tasks linked to Jira"
      >
        🔗 Jira
      </button>

      {/* Clear */}
      {hasFilter ? (
        <button
          onClick={() => onChange(null)}
          className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          ✕ Clear
        </button>
      ) : null}
    </div>
  );
}