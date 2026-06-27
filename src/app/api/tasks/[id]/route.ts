import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';
import { authenticate, getMemberRole, AuthError } from '@/lib/auth';
import type { UpdateTaskInput, TaskPriority } from '@/lib/types';

const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

// GET /api/tasks/[id] — return single task with detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const task = await q.getTaskDetail(id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json(task);
  } catch (err) {
    console.error('GET /api/tasks/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] — update individual task fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json() as UpdateTaskInput & { projectId?: string };
    const projectId = body.projectId;
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Validate priority if provided
    if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Only owner/editor can update tasks
    const role = await getMemberRole(projectId, session.memberId);
    if (role === 'viewer' || role === null) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: _id, projectId: _pid, ...fields } = body;
    await q.updateTask({ id, ...fields } as UpdateTaskInput);
    await broadcastBoardUpdate(projectId, 'task-updated');
    const updated = await q.getTaskDetail(id);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('PATCH /api/tasks/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}