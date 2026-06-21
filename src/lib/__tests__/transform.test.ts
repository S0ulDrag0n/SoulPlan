import {
  toBoard,
  toRelease,
  toSprint,
  toTask,
  toDependency,
  toStickyNote,
  toNoteConnection,
  toProject,
  toUser,
  toGuest,
  toProjectMember,
  toProjectInvite,
  toSession,
  taskToRow,
  sprintToRow,
  releaseToRow,
  stickyNoteToRow,
  assembleBoardState,
  moveTaskBetweenSprints,
  findTaskById,
  findSprintById,
  findSprintIdForTask,
  resolveDropTarget,
  nextPosition,
} from '../transform';
import type {
  BoardRow, ReleaseRow, SprintRow, TaskRow, DependencyRow,
  StickyNoteRow, NoteConnectionRow,
  ProjectRow, UserRow, GuestRow, ProjectMemberRow, ProjectInviteRow, SessionRow,
} from '../db/types';
import type { BoardState } from '../types';

// ─── Test fixtures ────────────────────────────────────────

const boardRow: BoardRow = {
  id: 'b1',
  name: 'Test Board',
  project_id: null,
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
  start_date: null,
  end_date: null,
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

const stickyNoteRow: StickyNoteRow = {
  id: 'n1',
  board_id: 'b1',
  text: 'Remember to deploy',
  x: 100,
  y: 200,
  color: 'yellow',
  z: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const noteConnRow: NoteConnectionRow = {
  id: 'nc1',
  note_id: 'n1',
  to_type: 'task',
  to_id: 't1',
  created_at: '2025-01-01T00:00:00Z',
};

const projectRow: ProjectRow = {
  id: 'p1',
  name: 'My Project',
  owner_id: 'u1',
  is_archived: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const userRow: UserRow = {
  id: 'u1',
  username: 'alice',
  password_hash: 'salt:hash',
  display_name: 'Alice',
  created_at: '2025-01-01T00:00:00Z',
};

const guestRow: GuestRow = {
  id: 'g1',
  name: 'Bob the Guest',
  created_at: '2025-01-01T00:00:00Z',
};

const memberRow: ProjectMemberRow = {
  id: 'pm1',
  project_id: 'p1',
  member_type: 'user',
  member_id: 'u1',
  role: 'owner',
  created_at: '2025-01-01T00:00:00Z',
};

const inviteRow: ProjectInviteRow = {
  id: 'inv1',
  project_id: 'p1',
  token: 'abc123',
  role: 'editor',
  created_at: '2025-01-01T00:00:00Z',
  expires_at: null,
};

const sessionRow: SessionRow = {
  token: 'tok123',
  member_type: 'user',
  member_id: 'u1',
  display_name: 'Alice',
  created_at: '2025-01-01T00:00:00Z',
};

// ─── Helper to build a minimal BoardState ───────────────

function makeState(
  sprints: { id: string; tasks: { id: string; sprintId: string; position: number }[] }[] = []
): BoardState {
  return {
    board: { id: 'b1', name: 'Board', projectId: null, createdAt: '', updatedAt: '' },
    releases: [
      {
        id: 'r1', boardId: 'b1', name: 'R1', position: 0, targetDate: null, notes: null, createdAt: '',
        sprints: sprints.map((s, i) => ({
          id: s.id, releaseId: 'r1', name: `S${i}`, position: i, capacity: 10, capacityUnit: 'pt',
          startDate: null, endDate: null, notes: null, createdAt: '',
          tasks: s.tasks.map(t => ({
            id: t.id, sprintId: t.sprintId, title: `Task ${t.id}`, description: null,
            estimate: 3, color: '#000', isCritical: false, position: t.position, createdAt: '',
          })),
        })),
      },
    ],
    dependencies: [],
    stickyNotes: [],
    noteConnections: [],
  };
}

// ─── Row → Model transforms ────────────────────────────────

describe('toBoard', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toBoard(boardRow)).toEqual({
      id: 'b1', name: 'Test Board', projectId: null,
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });
  });

  it('handles non-null project_id', () => {
    expect(toBoard({ ...boardRow, project_id: 'p1' }).projectId).toBe('p1');
  });
});

describe('toRelease', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toRelease(releaseRow)).toEqual({
      id: 'r1', boardId: 'b1', name: 'Release 1', position: 0,
      targetDate: null, notes: null, createdAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('toSprint', () => {
  it('converts snake_case row to camelCase model including start/end dates', () => {
    expect(toSprint(sprintRow)).toEqual({
      id: 's1', releaseId: 'r1', name: 'Sprint 1', position: 0, capacity: 10,
      capacityUnit: 'points', startDate: null, endDate: null, notes: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('toTask', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toTask(taskRow)).toEqual({
      id: 't1', sprintId: 's1', title: 'Setup CI', description: null, estimate: 3,
      color: '#3b82f6', isCritical: false, position: 0, createdAt: '2025-01-01T00:00:00Z',
    });
  });

  it('converts is_critical=1 to true', () => {
    expect(toTask({ ...taskRow, is_critical: 1 }).isCritical).toBe(true);
  });

  it('converts is_critical=0 to false', () => {
    expect(toTask({ ...taskRow, is_critical: 0 }).isCritical).toBe(false);
  });
});

describe('toDependency', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toDependency(depRow)).toEqual({
      id: 'd1', fromTaskId: 't1', toTaskId: 't2', createdAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('toStickyNote', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toStickyNote(stickyNoteRow)).toEqual({
      id: 'n1', boardId: 'b1', text: 'Remember to deploy', x: 100, y: 200,
      color: 'yellow', z: 0, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('toNoteConnection', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toNoteConnection(noteConnRow)).toEqual({
      id: 'nc1', noteId: 'n1', toType: 'task', toId: 't1', createdAt: '2025-01-01T00:00:00Z',
    });
  });
});

// ─── Project / User / Guest / Member / Invite / Session ──

describe('toProject', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toProject(projectRow)).toEqual({
      id: 'p1', name: 'My Project', ownerId: 'u1', isArchived: false,
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });
  });

  it('converts is_archived=1 to true', () => {
    expect(toProject({ ...projectRow, is_archived: 1 }).isArchived).toBe(true);
  });

  it('converts is_archived=0 to false', () => {
    expect(toProject({ ...projectRow, is_archived: 0 }).isArchived).toBe(false);
  });

  it('handles null owner_id', () => {
    expect(toProject({ ...projectRow, owner_id: null }).ownerId).toBeNull();
  });
});

describe('toUser', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toUser(userRow)).toEqual({
      id: 'u1', username: 'alice', displayName: 'Alice', createdAt: '2025-01-01T00:00:00Z',
    });
  });

  it('handles null display_name', () => {
    expect(toUser({ ...userRow, display_name: null }).displayName).toBeNull();
  });
});

describe('toGuest', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toGuest(guestRow)).toEqual({
      id: 'g1', name: 'Bob the Guest', createdAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('toProjectMember', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toProjectMember(memberRow)).toEqual({
      id: 'pm1', projectId: 'p1', memberType: 'user', memberId: 'u1', role: 'owner',
      createdAt: '2025-01-01T00:00:00Z',
    });
  });
});

describe('toProjectInvite', () => {
  it('converts snake_case row to camelCase model with null expires_at', () => {
    expect(toProjectInvite(inviteRow)).toEqual({
      id: 'inv1', projectId: 'p1', token: 'abc123', role: 'editor',
      createdAt: '2025-01-01T00:00:00Z', expiresAt: null,
    });
  });

  it('handles non-null expires_at', () => {
    expect(toProjectInvite({ ...inviteRow, expires_at: '2025-12-31' }).expiresAt).toBe('2025-12-31');
  });
});

describe('toSession', () => {
  it('converts snake_case row to camelCase model', () => {
    expect(toSession(sessionRow)).toEqual({
      token: 'tok123', memberType: 'user', memberId: 'u1', displayName: 'Alice',
    });
  });
});

// ─── Model → Row transforms ────────────────────────────────

describe('taskToRow', () => {
  it('converts camelCase model to snake_case DB fields', () => {
    expect(taskToRow({ id: 't1', title: 'New Title', isCritical: true, sprintId: 's2' })).toEqual({
      title: 'New Title', is_critical: 1, sprint_id: 's2',
    });
  });

  it('omits undefined fields', () => {
    expect(taskToRow({ id: 't1' })).toEqual({});
  });

  it('converts isCritical=false to is_critical=0', () => {
    expect(taskToRow({ id: 't1', isCritical: false })).toEqual({ is_critical: 0 });
  });

  it('includes all defined fields', () => {
    expect(taskToRow({
      id: 't1', title: 'T', description: 'D', estimate: 5, color: '#fff',
      isCritical: true, sprintId: 's1', position: 2,
    })).toEqual({
      title: 'T', description: 'D', estimate: 5, color: '#fff',
      is_critical: 1, sprint_id: 's1', position: 2,
    });
  });
});

describe('sprintToRow', () => {
  it('converts camelCase model to snake_case DB fields', () => {
    expect(sprintToRow({
      id: 's1', name: 'Sprint A', capacity: 20, capacityUnit: 'hours',
      startDate: '2025-01-01', endDate: '2025-01-15', notes: 'notes',
    })).toEqual({
      name: 'Sprint A', capacity: 20, capacity_unit: 'hours',
      start_date: '2025-01-01', end_date: '2025-01-15', notes: 'notes',
    });
  });

  it('omits undefined fields', () => {
    expect(sprintToRow({ id: 's1' })).toEqual({});
  });

  it('includes only defined fields', () => {
    expect(sprintToRow({ id: 's1', name: 'S' })).toEqual({ name: 'S' });
  });
});

describe('releaseToRow', () => {
  it('converts camelCase model to snake_case DB fields', () => {
    expect(releaseToRow({
      id: 'r1', name: 'Rel', targetDate: '2025-06-01', notes: 'N',
    })).toEqual({ name: 'Rel', target_date: '2025-06-01', notes: 'N' });
  });

  it('omits undefined fields', () => {
    expect(releaseToRow({ id: 'r1' })).toEqual({});
  });
});

describe('stickyNoteToRow', () => {
  it('converts camelCase model to snake_case DB fields', () => {
    expect(stickyNoteToRow({ id: 'n1', text: 'hello', x: 10, y: 20, color: 'blue', z: 5 })).toEqual({
      text: 'hello', x: 10, y: 20, color: 'blue', z: 5,
    });
  });

  it('omits undefined fields', () => {
    expect(stickyNoteToRow({ id: 'n1' })).toEqual({});
  });
});

// ─── assembleBoardState ───────────────────────────────────

describe('assembleBoardState', () => {
  it('nests releases → sprints → tasks', () => {
    const taskRow2: TaskRow = { ...taskRow, id: 't2', sprint_id: 's1', title: 'Deploy' };
    const result = assembleBoardState(boardRow, [releaseRow], [sprintRow], [taskRow, taskRow2], [depRow]);
    expect(result.board.id).toBe('b1');
    expect(result.releases).toHaveLength(1);
    expect(result.releases[0].sprints).toHaveLength(1);
    expect(result.releases[0].sprints[0].tasks).toHaveLength(2);
    expect(result.dependencies).toHaveLength(1);
    expect(result.releases[0].sprints[0].tasks[0].isCritical).toBe(false);
  });

  it('returns empty board with no releases/sprints/tasks', () => {
    const result = assembleBoardState(boardRow, [], [], [], []);
    expect(result.releases).toEqual([]);
    expect(result.dependencies).toEqual([]);
    expect(result.stickyNotes).toEqual([]);
    expect(result.noteConnections).toEqual([]);
  });

  it('includes sticky notes and note connections', () => {
    const result = assembleBoardState(boardRow, [], [], [], [], [stickyNoteRow], [noteConnRow]);
    expect(result.stickyNotes).toHaveLength(1);
    expect(result.stickyNotes[0].text).toBe('Remember to deploy');
    expect(result.noteConnections).toHaveLength(1);
    expect(result.noteConnections[0].toType).toBe('task');
  });

  it('does not crash with orphaned tasks (task whose sprint_id has no matching sprint)', () => {
    const orphan: TaskRow = { ...taskRow, id: 'orphan', sprint_id: 'nonexistent-sprint' };
    const result = assembleBoardState(boardRow, [releaseRow], [sprintRow], [orphan], []);
    expect(result.releases[0].sprints[0].tasks).toHaveLength(0);
  });

  it('handles sprints with no matching release', () => {
    const orphanSprint: SprintRow = { ...sprintRow, id: 'orphan-sprint', release_id: 'nonexistent' };
    const result = assembleBoardState(boardRow, [releaseRow], [orphanSprint], [], []);
    expect(result.releases[0].sprints).toHaveLength(0);
  });
});

// ─── moveTaskBetweenSprints ───────────────────────────────

describe('moveTaskBetweenSprints', () => {
  it('moves a task from one sprint to another', () => {
    const state = makeState([
      { id: 's1', tasks: [{ id: 't1', sprintId: 's1', position: 0 }] },
      { id: 's2', tasks: [] },
    ]);
    const result = moveTaskBetweenSprints(state, 't1', 's2');
    expect(result.releases[0].sprints[0].tasks).toHaveLength(0);
    expect(result.releases[0].sprints[1].tasks).toHaveLength(1);
    expect(result.releases[0].sprints[1].tasks[0].sprintId).toBe('s2');
  });

  it('returns same state when task does not exist', () => {
    const state = makeState([{ id: 's1', tasks: [] }]);
    const result = moveTaskBetweenSprints(state, 'nonexistent', 's1');
    expect(result).toBe(state);
  });

  it('returns same state when target sprint does not exist', () => {
    const state = makeState([
      { id: 's1', tasks: [{ id: 't1', sprintId: 's1', position: 0 }] },
    ]);
    const result = moveTaskBetweenSprints(state, 't1', 'nonexistent');
    expect(result).toBe(state);
  });

  it('reorders within the same sprint when source === target', () => {
    const state = makeState([
      { id: 's1', tasks: [
        { id: 't1', sprintId: 's1', position: 0 },
        { id: 't2', sprintId: 's1', position: 1 },
        { id: 't3', sprintId: 's1', position: 2 },
      ]},
    ]);
    const result = moveTaskBetweenSprints(state, 't3', 's1', 0);
    const tasks = result.releases[0].sprints[0].tasks;
    expect(tasks.map(t => t.id)).toEqual(['t3', 't1', 't2']);
    expect(tasks.map(t => t.position)).toEqual([0, 1, 2]);
  });

  it('inserts at the beginning when insertIndex=0 (cross-sprint)', () => {
    const state = makeState([
      { id: 's1', tasks: [{ id: 't1', sprintId: 's1', position: 0 }] },
      { id: 's2', tasks: [
        { id: 't2', sprintId: 's2', position: 0 },
        { id: 't3', sprintId: 's2', position: 1 },
      ]},
    ]);
    const result = moveTaskBetweenSprints(state, 't1', 's2', 0);
    expect(result.releases[0].sprints[1].tasks.map(t => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('inserts at the end when insertIndex=-1 (default)', () => {
    const state = makeState([
      { id: 's1', tasks: [{ id: 't1', sprintId: 's1', position: 0 }] },
      { id: 's2', tasks: [{ id: 't2', sprintId: 's2', position: 0 }] },
    ]);
    const result = moveTaskBetweenSprints(state, 't1', 's2');
    expect(result.releases[0].sprints[1].tasks.map(t => t.id)).toEqual(['t2', 't1']);
  });

  it('inserts at the middle index (cross-sprint)', () => {
    const state = makeState([
      { id: 's1', tasks: [{ id: 't1', sprintId: 's1', position: 0 }] },
      { id: 's2', tasks: [
        { id: 't2', sprintId: 's2', position: 0 },
        { id: 't3', sprintId: 's2', position: 1 },
        { id: 't4', sprintId: 's2', position: 2 },
      ]},
    ]);
    const result = moveTaskBetweenSprints(state, 't1', 's2', 1);
    expect(result.releases[0].sprints[1].tasks.map(t => t.id)).toEqual(['t2', 't1', 't3', 't4']);
  });

  it('clamps insertIndex beyond bounds to end', () => {
    const state = makeState([
      { id: 's1', tasks: [{ id: 't1', sprintId: 's1', position: 0 }] },
      { id: 's2', tasks: [{ id: 't2', sprintId: 's2', position: 0 }] },
    ]);
    const result = moveTaskBetweenSprints(state, 't1', 's2', 999);
    expect(result.releases[0].sprints[1].tasks.map(t => t.id)).toEqual(['t2', 't1']);
  });

  it('reindexes positions in source sprint after removal', () => {
    const state = makeState([
      { id: 's1', tasks: [
        { id: 't1', sprintId: 's1', position: 0 },
        { id: 't2', sprintId: 's1', position: 1 },
        { id: 't3', sprintId: 's1', position: 2 },
      ]},
      { id: 's2', tasks: [] },
    ]);
    const result = moveTaskBetweenSprints(state, 't2', 's2');
    const sourceTasks = result.releases[0].sprints[0].tasks;
    expect(sourceTasks.map(t => t.id)).toEqual(['t1', 't3']);
    expect(sourceTasks.map(t => t.position)).toEqual([0, 1]);
  });
});

// ─── findTaskById / findSprintById / findSprintIdForTask ──

describe('findTaskById', () => {
  it('finds a task in the nested board state', () => {
    const state = makeState([
      { id: 's1', tasks: [
        { id: 't1', sprintId: 's1', position: 0 },
        { id: 't2', sprintId: 's1', position: 1 },
      ]},
    ]);
    expect(findTaskById(state, 't2')?.id).toBe('t2');
  });

  it('returns undefined for nonexistent task', () => {
    const state = makeState([{ id: 's1', tasks: [] }]);
    expect(findTaskById(state, 'nonexistent')).toBeUndefined();
  });

  it('returns undefined for empty board', () => {
    const state = makeState([]);
    expect(findTaskById(state, 't1')).toBeUndefined();
  });
});

describe('findSprintById', () => {
  it('finds a sprint in the nested board state', () => {
    const state = makeState([{ id: 's1', tasks: [] }]);
    expect(findSprintById(state, 's1')?.id).toBe('s1');
  });

  it('returns undefined for nonexistent sprint', () => {
    const state = makeState([{ id: 's1', tasks: [] }]);
    expect(findSprintById(state, 'nonexistent')).toBeUndefined();
  });
});

describe('findSprintIdForTask', () => {
  it('returns the sprint ID containing the task', () => {
    const state = makeState([
      { id: 's1', tasks: [{ id: 't1', sprintId: 's1', position: 0 }] },
      { id: 's2', tasks: [{ id: 't2', sprintId: 's2', position: 0 }] },
    ]);
    expect(findSprintIdForTask(state, 't2')).toBe('s2');
  });

  it('returns undefined for nonexistent task', () => {
    const state = makeState([{ id: 's1', tasks: [] }]);
    expect(findSprintIdForTask(state, 'nonexistent')).toBeUndefined();
  });

  it('returns undefined for empty board', () => {
    const state = makeState([]);
    expect(findSprintIdForTask(state, 't1')).toBeUndefined();
  });
});

// ─── resolveDropTarget ───────────────────────────────────

describe('resolveDropTarget', () => {
  it('resolves sprint ID when dropped directly on a sprint (append to end)', () => {
    const state = makeState([
      { id: 's1', tasks: [{ id: 't1', sprintId: 's1', position: 0 }] },
    ]);
    expect(resolveDropTarget(state, 's1')).toEqual({ sprintId: 's1', insertIndex: 1 });
  });

  it('resolves task ID to insert before that task', () => {
    const state = makeState([
      { id: 's1', tasks: [
        { id: 't1', sprintId: 's1', position: 0 },
        { id: 't2', sprintId: 's1', position: 1 },
      ]},
    ]);
    expect(resolveDropTarget(state, 't2')).toEqual({ sprintId: 's1', insertIndex: 1 });
  });

  it('returns undefined for unknown ID', () => {
    const state = makeState([{ id: 's1', tasks: [] }]);
    expect(resolveDropTarget(state, 'unknown')).toBeUndefined();
  });

  it('handles numeric overId by converting to string', () => {
    const state = makeState([{ id: '42', tasks: [] }]);
    expect(resolveDropTarget(state, 42)).toEqual({ sprintId: '42', insertIndex: 0 });
  });
});

// ─── nextPosition ─────────────────────────────────────────

describe('nextPosition', () => {
  it('returns 0 for empty array', () => {
    expect(nextPosition([])).toBe(0);
  });

  it('returns max position + 1', () => {
    expect(nextPosition([{ position: 0 }, { position: 2 }, { position: 4 }])).toBe(5);
  });

  it('returns 1 for single item at position 0', () => {
    expect(nextPosition([{ position: 0 }])).toBe(1);
  });

  it('handles negative positions (edge case)', () => {
    expect(nextPosition([{ position: -1 }, { position: -3 }])).toBe(0);
  });
});