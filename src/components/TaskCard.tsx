'use client';

import { useDraggable } from '@dnd-kit/core';
import type { Task } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: `4px solid ${task.color}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg shadow-sm p-3 mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 flex-1">{task.title}</span>
        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {task.estimate > 0 ? `${task.estimate}pt` : '—'}
        </span>
      </div>
      {!!task.is_critical && (
        <span className="text-xs text-red-600 font-semibold mt-1 inline-block">⚡ Critical</span>
      )}
      <div className="flex gap-1 mt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          className="text-xs text-gray-400 hover:text-blue-500"
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  );
}