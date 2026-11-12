'use client';

import { useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Dependency, Task } from '@/lib/types';
import { useDependencyConnector } from './DependencyConnector';
import { Icon } from './Icon';
import { JiraBadge } from './JiraBadge';

interface SortableTaskCardProps {
  task: Task;
  blockingDeps?: Dependency[];
  blockedByDeps?: Dependency[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onJumpToTask?: (taskId: string) => void;
  onSelect?: (task: Task) => void;
  dimmed?: boolean;
  editingBy?: string | null;
  assigneeName?: string | null;
  onMatch?: (task: Task) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function colorFromString(str: string): string {
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function SortableTaskCard({
  task, blockingDeps = [], blockedByDeps = [], onEdit, onDelete, onJumpToTask, onSelect,
  dimmed = false, editingBy = null, assigneeName = null, onMatch,
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { type: 'task', task } });
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
    e.stopPropagation(); e.preventDefault();
    if (connectorRef.current) startConnection(task.id, connectorRef.current);
  }, [task.id, startConnection]);

  const assigneeColor = assigneeName ? colorFromString(assigneeName) : null;

  return (
    <div ref={setNodeRef} data-task-id={task.id} style={style} onClick={() => onSelect?.(task)}
      className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-900/30 p-3 mb-2 hover:shadow-md hover-lift transition-all cursor-pointer${isDropTarget ? ' ring-2 ring-green-400 dark:ring-green-500 ring-offset-1' : ''}`}>
      <div {...attributes} {...listeners} className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing">
        <span className={`text-sm font-medium flex-1 ${task.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>{task.title}</span>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{task.estimate > 0 ? `${task.estimate}pt` : '\u2014'}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        {task.status === 'done' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
            <Icon name="check" className="w-3 h-3" strokeWidth={3} /> Done
          </span>
        ) : null}
        {task.status === 'in-progress' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            <Icon name="circle-half" className="w-3 h-3" /> In Progress
          </span>
        ) : null}
        {task.isCritical ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
            <Icon name="bolt" className="w-3 h-3" strokeWidth={2.5} /> Critical
          </span>
        ) : null}
        {assigneeName && assigneeColor ? (
          <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: assigneeColor }} title={assigneeName}>{getInitials(assigneeName)}</span>
        ) : null}
      </div>
      {editingBy ? (
        <span className="inline-flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 mt-1 animate-pulse" title={`${editingBy} is editing this task`}>
          <Icon name="edit" className="w-3 h-3" /> {editingBy} editing\u2026
        </span>
      ) : null}
      {(blockingDeps.length > 0 || blockedByDeps.length > 0) ? (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {blockedByDeps.map((dep) => (
            <button key={dep.id} onClick={(e) => { e.stopPropagation(); onJumpToTask?.(dep.fromTaskId); }} className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors" title={`Blocked by task ${dep.fromTaskId}`}>blocked</button>
          ))}
          {blockingDeps.map((dep) => (
            <button key={dep.id} onClick={(e) => { e.stopPropagation(); onJumpToTask?.(dep.toTaskId); }} className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors" title={`Blocks task ${dep.toTaskId}`}>blocks</button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1 items-center">
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
          {onMatch && !task.jiraIssueKey ? (
            <button
              onClick={(e) => { e.stopPropagation(); onMatch(task); }}
              className="text-xs text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Link to Jira issue"
            >
              Jira
            </button>
          ) : null}
          {task.jiraIssueKey ? (
            <JiraBadge issueKey={task.jiraIssueKey} status={task.jiraStatus} />
          ) : null}
        </div>
        <button ref={connectorRef} onPointerDown={handleConnectorPointerDown} onClick={(e) => e.stopPropagation()} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-all cursor-crosshair hover:scale-110" title="Drag to another task to create a dependency">
          <Icon name="link" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
