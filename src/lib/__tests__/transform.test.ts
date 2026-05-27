import {
  toBoard,
  toRelease,
  toSprint,
  toTask,
  toDependency,
  taskToRow,
  assembleBoardState,
  moveTaskBetweenSprints,
  findTaskById,
  findSprintIdForTask,
  resolveDropTarget,
  nextPosition,
} from '../transform';
import type { BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow } from '../../db/types';
import type { BoardState } from '../../types';

// ─── Test fixtures ────────────────────────────────────────

const boardRow: BoardRow = {
  id: 'b1',
  name: 'Test Board',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const releaseRow: ReleaseRow = {
  id: 'r1',
  board_id: 'b1',
  name: 'Release 1',
  position: 0,
  target_date: null,
  notes: null,
  created_at: '2025-01-01T00:00:00Z',
};

const sprintRow: SprintRow = {
  id: 's1',
  release_id: 'r1',
  name: 'Sprint 1',
  position: 0,
  capacity: 10,
  capacity_unit: 'points',
  notes: null,
  created_at: '2025-01-01T00:00:00Z',
};

const taskRow: TaskRow = {
  id: 't1',
  sprint_id: 's1',
  title: 'Setup CI',
  description: null,
  estimate: 3,
  color: '#3b82f6',
  is_critical: 0,
  position: 0,
  created_at: '2025-01-01T00:00:00Z',
};

const depRow: DependencyRow = {
  id: 'd1',
  from_task_id: 't1',
  to_task_id: 't2',
  created_at: '2025-01-01T00:00:00Z',
};

// ─── Transform tests ────────────────────────────────────

describe('toBoard', () => {
  it('converts snake_case row to camelCase model', () => {
    const result = toBoard(boardRow);
    expect(result).toEqual({
      id: 'b1',
      name: 'Test Board',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('toRelease', () => {
  it('converts snake_case row to camelCase model', () => {
    const result = toRelease(releaseRow);
    expect(result).toEqual({
      id: 'r1',
      boardId: 'b1',
      name: 'Release 1',
      position: 0,
      targetDate: null,
      notes: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('toSprint', () => {
  it('converts snake_case row to camelCase model', () => {
    const result = toSprint(sprintRow);
    expect(result).toEqual({
      id: 's1',
      releaseId: 'r1',
      name: 'Sprint 1',
      position: 0,
      capacity: 10,
      capacityUnit: 'points',
      notes: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('toTask', () => {
  it('converts snake_case row to camelCase model', () => {
    const result = toTask(taskRow);
    expect(result).toEqual({
      id: 't1',
      sprintId: 's1',
      title: 'Setup CI',
      description: null,
      estimate: 3,
      color: '#3b82f6',
      isCritical: false,
      position: 0,
      createdAt: '2025-01-01T00:00:00Z',
    });
  });

  it('converts is_critical=1 to true', () => {
    const result = toTask({ ...taskRow, is_critical: 1 });
    expect(result.isCritical).toBe(true);
  });
});

describe('toDependency', () => {
  it('converts snake_case row to camelCase model', () => {
    const result = toDependency(depRow);
    expect(result).toEqual({
      id: 'd1',
      fromTaskId: 't1',
      toTaskId: 't2',
      createdAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('taskToRow', () => {
  it('converts camelCase model to snake_case DB fields', () => {
    const result = taskToRow({
      id: 't1',
      title: 'New Title',
      isCritical: true,
      sprintId: 's2',
    });
    expect(result).toEqual({
      title: 'New Title',
      is_critical: 1,
      sprint_id: 's2',
    });
  });

  it('omits undefined fields', () => {
    const result = taskToRow({ id: 't1' });
    expect(result).toEqual({});
  });
});

describe('assembleBoardState', () => {
  it('nests releases → sprints → tasks', () => {
    const taskRow2: TaskRow = { ...taskRow, id: 't2', sprint_id: 's1', title: 'Deploy' };
    const result = assembleBoardState(
      boardRow,
      [releaseRow],
      [sprintRow],
      [taskRow, taskRow2],
      [depRow]
    );

    expect(result.board.id).toBe('b1');
    expect(result.releases).toHaveLength(1);
    expect(result.releases[0].sprints).toHaveLength(1);
    expect(result.releases[0].sprints[0].tasks).toHaveLength(2);
    expect(result.dependencies).toHaveLength(1);
    expect(result.releases[0].sprints[0].tasks[0].isCritical).toBe(false);
  });
});

describe('moveTaskBetweenSprints', () => {
  it('moves a task from one sprint to another', () => {
    const state: BoardState = {
      board: { id: 'b1', name: 'Board', createdAt: '', updatedAt: '' },
      releases: [{
        id: 'r1', boardId: 'b1', name: 'R1', position: 0, targetDate: null, notes: null, createdAt: '',
        sprints: [
          {
            id: 's1', releaseId: 'r1', name: 'S1', position: 0, capacity: 10, capacityUnit: 'pt', notes: null, createdAt: '',
            tasks: [
              { id: 't1', sprintId: 's1', title: 'Task', description: null, estimate: 3, color: '#000', isCritical: false, position: 0, createdAt: '' },
            ],
          },
          {
            id: 's2', releaseId: 'r1', name: 'S2', position: 1, capacity: 10, capacityUnit: 'pt', notes: null, createdAt: '',
            tasks: [],
          },
        ],
      }],
      dependencies: [],
    };

    const result = moveTaskBetweenSprints(state, 't1', 's2');
    expect(result.releases[0].sprints[0].tasks).toHaveLength(0);
    expect(result.releases[0].sprints[1].tasks).toHaveLength(1);
    expect(result.releases[0].sprints[1].tasks[0].sprintId).toBe('s2');
  });

  it('returns same state when source === target', () => {
    const state: BoardState = {
      board: { id: 'b1', name: 'Board', createdAt: '', updatedAt: '' },
      releases: [{
        id: 'r1', boardId: 'b1', name: 'R1', position: 0, targetDate: null, notes: null, createdAt: '',
        sprints: [
          {
            id: 's1', releaseId: 'r1', name: 'S1', position: 0, capacity: 10, capacityUnit: 'pt', notes: null, createdAt: '',
            tasks: [
              { id: 't1', sprintId: 's1', title: 'Task', description: null, estimate: 3, color: '#000', isCritical: false, position: 0, createdAt: '' },
            ],
          },
        ],
      }],
      dependencies: [],
    };

    const result = moveTaskBetweenSprints(state, 't1', 's1');
    // Same sprint, no change
    expect(result.releases[0].sprints[0].tasks).toHaveLength(1);
  });
});

describe('findTaskById', () => {
  it('finds a task in the nested board state', () => {
    const state: BoardState = {
      board: { id: 'b1', name: 'Board', createdAt: '', updatedAt: '' },
      releases: [{
        id: 'r1', boardId: 'b1', name: 'R1', position: 0, targetDate: null, notes: null, createdAt: '',
        sprints: [{
          id: 's1', releaseId: 'r1', name: 'S1', position: 0, capacity: 10, capacityUnit: 'pt', notes: null, createdAt: '',
          tasks: [
            { id: 't1', sprintId: 's1', title: 'Task 1', description: null, estimate: 3, color: '#000', isCritical: false, position: 0, createdAt: '' },
            { id: 't2', sprintId: 's1', title: 'Task 2', description: null, estimate: 5, color: '#000', isCritical: true, position: 1, createdAt: '' },
          ],
        }],
      }],
      dependencies: [],
    };

    expect(findTaskById(state, 't2')?.title).toBe('Task 2');
    expect(findTaskById(state, 'nonexistent')).toBeUndefined();
  });
});

describe('resolveDropTarget', () => {
  it('resolves sprint ID when dropped directly on a sprint', () => {
    const state: BoardState = {
      board: { id: 'b1', name: 'Board', createdAt: '', updatedAt: '' },
      releases: [{
        id: 'r1', boardId: 'b1', name: 'R1', position: 0, targetDate: null, notes: null, createdAt: '',
        sprints: [{
          id: 's1', releaseId: 'r1', name: 'S1', position: 0, capacity: 10, capacityUnit: 'pt', notes: null, createdAt: '',
          tasks: [{ id: 't1', sprintId: 's1', title: 'Task', description: null, estimate: 3, color: '#000', isCritical: false, position: 0, createdAt: '' }],
        }],
      }],
      dependencies: [],
    };

    expect(resolveDropTarget(state, 's1')).toBe('s1');
    expect(resolveDropTarget(state, 't1')).toBe('s1'); // dropped on task → find its sprint
    expect(resolveDropTarget(state, 'unknown')).toBeUndefined();
  });
});

describe('nextPosition', () => {
  it('returns 0 for empty array', () => {
    expect(nextPosition([])).toBe(0);
  });

  it('returns max position + 1', () => {
    expect(nextPosition([{ position: 0 }, { position: 2 }, { position: 4 }])).toBe(5);
  });
});