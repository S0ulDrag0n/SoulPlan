import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';
import { requireAuth } from '@/lib/auth';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/types';

// POST /api/tasks — create a task
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: CreateTaskInput & { projectId?: string } = await req.json();
    if (!body.sprintId || !body.title) {
      return NextResponse.json({ error: 'sprintId and title required' }, { status: 400 });
    }
    const { projectId, ...input } = body;
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    const task = await q.createTask(input);
    broadcastBoardUpdate(projectId, 'task-created');
    q.logActivity(projectId, session.memberId, 'created', 'task', task.id, task.title).catch(() => {});
    return NextResponse.json(task);
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// PATCH /api/tasks — update a task (move between sprints, edit fields)
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: UpdateTaskInput & { projectId?: string } = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const { projectId, ...input } = body;
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    await q.updateTask(input);
    broadcastBoardUpdate(projectId, 'task-updated');
    q.logActivity(projectId, session.memberId, 'updated', 'task', input.id, input.title).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks — delete a task
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, projectId } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    await q.deleteTask(id);
    broadcastBoardUpdate(projectId, 'task-deleted');
    q.logActivity(projectId, session.memberId, 'deleted', 'task', id).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}