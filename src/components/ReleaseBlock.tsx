'use client';

import type { Release, Sprint, Task } from '@/lib/types';
import SprintColumn from './SprintColumn';

interface ReleaseBlockProps {
  release: Release & { sprints: (Sprint & { tasks: Task[] })[] };
  onAddSprint: (releaseId: string) => void;
  onEditRelease: (release: Release) => void;
  onDeleteRelease: (id: string) => void;
  onAddTask: (sprintId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (id: string) => void;
}

export default function ReleaseBlock({
  release, onAddSprint, onEditRelease, onDeleteRelease,
  onAddTask, onEditTask, onDeleteTask, onEditSprint, onDeleteSprint,
}: ReleaseBlockProps) {
  return (
    <div className="flex flex-col border-2 border-gray-300 rounded-2xl bg-gray-100/50 min-w-fit">
      {/* Release header */}
      <div className="px-4 py-3 bg-gray-800 text-white rounded-t-2xl flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{release.name}</h2>
          {release.targetDate && (
            <span className="text-xs text-gray-300">Target: {release.targetDate}</span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEditRelease(release)}
            className="text-gray-300 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700"
            title="Edit release"
          >
            ✏️
          </button>
          <button
            onClick={() => onDeleteRelease(release.id)}
            className="text-gray-300 hover:text-red-400 text-sm px-2 py-1 rounded hover:bg-gray-700"
            title="Delete release"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Sprints row */}
      <div className="flex gap-4 p-4 overflow-x-auto">
        {release.sprints.map((sprint) => (
          <SprintColumn
            key={sprint.id}
            sprint={sprint}
            tasks={sprint.tasks}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onEditSprint={onEditSprint}
            onDeleteSprint={onDeleteSprint}
          />
        ))}
        <button
          onClick={() => onAddSprint(release.id)}
          className="min-w-[180px] border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
        >
          + Add Sprint
        </button>
      </div>
    </div>
  );
}