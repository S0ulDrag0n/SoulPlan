'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableTaskCard from './SortableTaskCard';
import type { Dependency, Sprint, Task } from '@/lib/types';

interface SprintColumnProps {
  sprint: Sprint;
  tasks: Task[];
  dependencies: Dependency[];
  onAddTask: (sprintId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (id: string) => void;
  onJumpToTask?: (taskId: string) => void;
}

export default function SprintColumn({
  sprint, tasks, dependencies, onAddTask, onEditTask, onDeleteTask,
  onEditSprint, onDeleteSprint, onJumpToTask,
}: SprintColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: sprint.id,
    data: { type: 'sprint', sprint },
  });

  const dateRange = [sprint.startDate, sprint.endDate].filter(Boolean).join(' → ');
  const usedCapacity = tasks.reduce((sum, t) => sum + (t.estimate || 0), 0);

  const taskIds = tasks.map(t => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[220px] max-w-[280px] flex flex-col rounded-xl border-2 transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      {/* Sprint header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-white rounded-t-xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-700 truncate">{sprint.name}</h3>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded shrink-0">
            {usedCapacity}/{sprint.capacity}{sprint.capacityUnit}
          </span>
        </div>
        {(dateRange || sprint.notes) && (
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
            {dateRange && <span>{dateRange}</span>}
            {sprint.notes && (
              <span className="italic truncate">{sprint.notes}</span>
            )}
          </div>
        )}
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onEditSprint(sprint)}
            className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDeleteSprint(sprint.id)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Sortable tasks */}
      <div className="flex-1 px-3 py-2 min-h-[120px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => {
            const blockingDeps = dependencies.filter(d => d.fromTaskId === task.id);
            const blockedByDeps = dependencies.filter(d => d.toTaskId === task.id);
            return (
              <SortableTaskCard
                key={task.id}
                task={task}
                blockingDeps={blockingDeps}
                blockedByDeps={blockedByDeps}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onJumpToTask={onJumpToTask}
              />
            );
          })}
        </SortableContext>
      </div>

      {/* Footer: add task */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-100 rounded-b-xl">
        <button
          onClick={() => onAddTask(sprint.id)}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium"
        >
          + Add Task
        </button>
      </div>
    </div>
  );
}