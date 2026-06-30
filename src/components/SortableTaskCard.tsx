'use client';

import { useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Dependency, Task } from '@/lib/types';
import { useDependencyConnector } from './DependencyConnector';

interface SortableTaskCardProps {
  task: Task;
  blockingDeps?: Dependency[];
  blockedByDeps?: Dependency[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onJumpToTask?: (taskId: string) => void;
  onSelect?: (task: Task) => void;
  dimmed?: boolean;
}

export default function SortableTaskCard({
  task,
  blockingDeps = [],
  blockedByDeps = [],
  onEdit,
  onDelete,
  onJumpToTask,
  onSelect,
  dimmed = false,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } });

  const { connectionMode, hoveredTaskId, startConnection } = useDependencyConnector();
  const connectorRef = useRef<HTMLButtonElement>(null);

  const isDropTarget = connectionMode && hoveredTaskId === task.id;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0 : dimmed ? 0.3 : 1,
    borderLeft: `4px solid ${task.color}`,
  };

  const handleConnectorPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (connectorRef.current) {
      startConnection(task.id, connectorRef.current);
    }
  }, [task.id, startConnection]);

  return (
    <div
      ref={setNodeRef}
      data-task-id={task.id}
      style={style}
      onClick={() => onSelect?.(task)}
      className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-900/30 p-3 mb-2 hover:shadow-md transition-shadow cursor-pointer${
        isDropTarget ? ' ring-2 ring-green-400 dark:ring-green-500 ring-offset-1' : ''
      }`}
    >
      {/* Drag handle area — only this top section triggers dnd-kit drag */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
      >
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-1">{task.title}</span>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
          {task.estimate > 0 ? `${task.estimate}pt` : '—'}
        </span>
      </div>
      {task.isCritical ? (
        <span className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1 inline-block">⚡ Critical</span>
      ) : null}

      {/* Dependency badges */}
      {(blockingDeps.length > 0 || blockedByDeps.length > 0) ? (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {blockedByDeps.map((dep) => (
            <button
              key={dep.id}
              onClick={(e) => { e.stopPropagation(); onJumpToTask?.(dep.fromTaskId); }}
              className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors"
              title={`Blocked by task ${dep.fromTaskId}`}
            >
              ← blocked
            </button>
          ))}
          {blockingDeps.map((dep) => (
            <button
              key={dep.id}
              onClick={(e) => { e.stopPropagation(); onJumpToTask?.(dep.toTaskId); }}
              className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
              title={`Blocks task ${dep.toTaskId}`}
            >
              → blocks
            </button>
          ))}
        </div>
      ) : null}

      {/* Bottom row: action buttons + connector handle */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this task?')) onDelete(task.id); }}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
          >
            Delete
          </button>
        </div>

        {/* Dependency connector handle — drag from here to another task to create a dependency */}
        <button
          ref={connectorRef}
          onPointerDown={handleConnectorPointerDown}
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-crosshair"
          title="Drag to another task to create a dependency (this task blocks the target)"
        >
          🔗
        </button>
      </div>
    </div>
  );
}