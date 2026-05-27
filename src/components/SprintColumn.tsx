'use client';

import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';
import type { Sprint, Task } from '@/lib/types';

interface SprintColumnProps {
  sprint: Sprint;
  tasks: Task[];
  onAddTask: (sprintId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (id: string) => void;
}

export default function SprintColumn({
  sprint, tasks, onAddTask, onEditTask, onDeleteTask,
  onEditSprint, onDeleteSprint,
}: SprintColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: sprint.id,
    data: { type: 'sprint', sprint },
  });

  const dateRange = [sprint.startDate, sprint.endDate].filter(Boolean).join(' → ');

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[220px] max-w-[280px] flex flex-col rounded-xl border-2 transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      {/* Sprint header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-white rounded-t-xl flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-700 truncate">{sprint.name}</h3>
          {dateRange && (
            <div className="text-xs text-gray-400">{dateRange}</div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEditSprint(sprint)}
            className="text-gray-400 hover:text-gray-600 text-xs px-1 rounded hover:bg-gray-100"
            title="Edit sprint"
          >
            ✏️
          </button>
          <button
            onClick={() => onDeleteSprint(sprint.id)}
            className="text-gray-400 hover:text-red-500 text-xs px-1 rounded hover:bg-gray-100"
            title="Delete sprint"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 px-3 py-2 space-y-2 min-h-[120px]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
          />
        ))}
      </div>

      {/* Footer: capacity + notes */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-100 rounded-b-xl">
        <div className="text-xs text-gray-500">
          Capacity: <span className="font-semibold">{sprint.capacity}{sprint.capacityUnit}</span>
        </div>
        {sprint.notes && (
          <div className="text-xs text-gray-400 mt-1 italic truncate">{sprint.notes}</div>
        )}
        <button
          onClick={() => onAddTask(sprint.id)}
          className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium"
        >
          + Add Task
        </button>
      </div>
    </div>
  );
}