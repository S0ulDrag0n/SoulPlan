'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Dependency, Task } from '@/lib/types';

interface SortableTaskCardProps {
  task: Task;
  /** Dependencies that have this task as the *from* (this task blocks others) */
  blockingDeps?: Dependency[];
  /** Dependencies that have this task as the *to* (this task is blocked by others) */
  blockedByDeps?: Dependency[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onJumpToTask?: (taskId: string) => void;
}

export default function SortableTaskCard({
  task,
  blockingDeps = [],
  blockedByDeps = [],
  onEdit,
  onDelete,
  onJumpToTask,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
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
      {task.isCritical && (
        <span className="text-xs text-red-600 font-semibold mt-1 inline-block">⚡ Critical</span>
      )}

      {/* Dependency badges */}
      {(blockingDeps.length > 0 || blockedByDeps.length > 0) && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {blockedByDeps.map((dep) => (
            <button
              key={dep.id}
              onClick={(e) => { e.stopPropagation(); onJumpToTask?.(dep.fromTaskId); }}
              className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
              title={`Blocked by task ${dep.fromTaskId}`}
            >
              ← blocked
            </button>
          ))}
          {blockingDeps.map((dep) => (
            <button
              key={dep.id}
              onClick={(e) => { e.stopPropagation(); onJumpToTask?.(dep.toTaskId); }}
              className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
              title={`Blocks task ${dep.toTaskId}`}
            >
              → blocks
            </button>
          ))}
        </div>
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