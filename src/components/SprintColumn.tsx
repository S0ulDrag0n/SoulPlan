'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableTaskCard from './SortableTaskCard';
import { Icon } from './Icon';
import type { Dependency, Sprint, SprintWithTasks, Task, ProjectMember } from '@/lib/types';

interface SprintColumnProps {
  sprint: SprintWithTasks;
  tasks: Task[];
  dependencies: Dependency[];
  onAddTask: (sprintId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (id: string) => void;
  onJumpToTask?: (taskId: string) => void;
  onSelectTask?: (task: Task) => void;
  dimmedTaskIds?: Set<string> | null;
  editingByTask?: Map<string, string> | null;
  onShowBurndown?: (sprintId: string, sprintName: string) => void;
  members?: ProjectMember[];
  onMatchTasks?: (task: Task) => void;
}

export default function SprintColumn({
  sprint, tasks, dependencies, onAddTask, onEditTask, onDeleteTask,
  onEditSprint, onDeleteSprint, onJumpToTask, onSelectTask, dimmedTaskIds, editingByTask, onShowBurndown, members, onMatchTasks,
}: SprintColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: sprint.id,
    data: { type: 'sprint', sprint },
  });

  const dateRange = [sprint.startDate, sprint.endDate].filter(Boolean).join(' \u2192 ');
  const usedCapacity = tasks.reduce((sum, t) => sum + (t.estimate || 0), 0);
  const capacityRatio = sprint.capacity > 0 ? Math.min(1, usedCapacity / sprint.capacity) : 0;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const progressRatio = tasks.length > 0 ? doneCount / tasks.length : 0;

  // Accent color based on sprint progress
  const accentColor = progressRatio > 0.75 ? '#22c55e' : progressRatio > 0.25 ? '#3b82f6' : '#9ca3af';

  const taskIds = tasks.map(t => t.id);

  // Build assignee name lookup
  const memberMap = new Map<string, string>();
  if (members) {
    for (const m of members) {
      memberMap.set(m.memberId, m.memberType === 'user' ? `User (${m.role})` : `Guest (${m.role})`);
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-sprint-id={sprint.id}
      className={`min-w-[220px] max-w-[280px] flex flex-col rounded-xl border-2 transition-colors ${
        isOver
          ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
      }`}
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      {/* Sprint header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">{sprint.name}</h3>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded shrink-0">
            {usedCapacity}/{sprint.capacity} {sprint.capacityUnit}
          </span>
        </div>

        {/* Capacity progress bar */}
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${capacityRatio * 100}%`,
              backgroundColor: capacityRatio > 1 ? '#ef4444' : accentColor,
            }}
          />
        </div>

        {dateRange && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{dateRange}</div>
        )}
        {sprint.notes && (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5 line-clamp-2">{sprint.notes}</div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => onEditSprint(sprint)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            Edit
          </button>
          {onShowBurndown ? (
            <button
              onClick={() => onShowBurndown(sprint.id, sprint.name)}
              className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              title="Burndown chart"
            >
              <Icon name="chart" className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={() => onDeleteSprint(sprint.id)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Sortable tasks */}
      <div className="flex-1 px-3 py-2 min-h-[80px]">
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
                onSelect={onSelectTask}
                dimmed={dimmedTaskIds?.has(task.id) ?? false}
                editingBy={editingByTask?.get(task.id) ?? null}
                assigneeName={task.assigneeId ? memberMap.get(task.assigneeId) ?? null : null}
                onMatch={onMatchTasks}
              />
            );
          })}
        </SortableContext>
      </div>

      {/* Dashed add-task card at bottom */}
      <button
        onClick={() => onAddTask(sprint.id)}
        className="mx-3 mb-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 dark:text-gray-500 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors text-sm font-medium inline-flex items-center gap-1 justify-center"
      >
        <Icon name="plus" className="w-4 h-4" /> Task
      </button>
    </div>
  );
}
