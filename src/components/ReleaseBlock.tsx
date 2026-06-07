'use client';

import SprintColumn from './SprintColumn';
import type { Dependency, Release, ReleaseWithSprints } from '@/lib/types';

interface ReleaseBlockProps {
  release: ReleaseWithSprints;
  onAddSprint: (releaseId: string) => void;
  onEditRelease: (release: Release) => void;
  onDeleteRelease: (id: string) => void;
  onAddTask: (sprintId: string) => void;
  onEditTask: (task: import('@/lib/types').Task) => void;
  onDeleteTask: (id: string) => void;
  onEditSprint: (sprint: import('@/lib/types').Sprint) => void;
  onDeleteSprint: (id: string) => void;
  dependencies: Dependency[];
  onJumpToTask?: (taskId: string) => void;
}

export default function ReleaseBlock({
  release, onAddSprint, onEditRelease, onDeleteRelease,
  onAddTask, onEditTask, onDeleteTask,
  onEditSprint, onDeleteSprint, dependencies, onJumpToTask,
}: ReleaseBlockProps) {
  const targetDate = release.targetDate
    ? new Date(release.targetDate).toLocaleDateString()
    : null;

  return (
    <div className="flex flex-col min-w-[280px]" data-release-id={release.id}>
      {/* Release header */}
      <div className="mb-3 px-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{release.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditRelease(release)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDeleteRelease(release.id)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
        {targetDate && (
          <div className="text-xs text-gray-400 dark:text-gray-500">
            Target: {targetDate}
          </div>
        )}
      </div>

      {/* Sprint columns */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {release.sprints.map((sprint) => (
          <SprintColumn
            key={sprint.id}
            sprint={sprint}
            tasks={sprint.tasks}
            dependencies={dependencies}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onEditSprint={onEditSprint}
            onDeleteSprint={onDeleteSprint}
            onJumpToTask={onJumpToTask}
          />
        ))}

        {/* Add sprint button */}
        <button
          onClick={() => onAddSprint(release.id)}
          className="min-w-[220px] max-w-[280px] h-[120px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-400 dark:text-gray-500 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex items-center justify-center text-sm font-medium shrink-0"
        >
          + Sprint
        </button>
      </div>
    </div>
  );
}