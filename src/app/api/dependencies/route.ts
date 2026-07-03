import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';
import { authenticate, getMemberRole, AuthError } from '@/lib/auth';

// POST /api/dependencies — create a dependency (fromTaskId → toTaskId meaning "from blocks to")
export async function POST(req: NextRequest) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fromTaskId, toTaskId, projectId } = body;
    if (!fromTaskId || !toTaskId) {
      return NextResponse.json({ error: 'fromTaskId and toTaskId required' }, { status: 400 });
    }
    if (fromTaskId === toTaskId) {
      return NextResponse.json({ error: 'Cannot create self-referencing dependency' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Only owner/editor can create dependencies
    const role = await getMemberRole(projectId, session.memberId);
    if (role === 'viewer' || role === null) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check for duplicate dependency
    const existing = await q.findDependency(fromTaskId, toTaskId);
    if (existing) {
      return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
    }
    const dep = await q.createDependency(fromTaskId, toTaskId);
    q.logActivity(projectId, session.memberId, 'created', 'dependency', dep.id, `${fromTaskId}→${toTaskId}`).catch(() => {});
    broadcastBoardUpdate(projectId, 'dependency-created');
    return NextResponse.json(dep);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/dependencies error:', error);
    return NextResponse.json({ error: 'Failed to create dependency' }, { status: 500 });
  }
}

// DELETE /api/dependencies — delete a dependency by id
export async function DELETE(req: NextRequest) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, projectId } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Only owner/editor can delete dependencies
    const role = await getMemberRole(projectId, session.memberId);
    if (role === 'viewer' || role === null) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await q.deleteDependency(id);
    q.logActivity(projectId, session.memberId, 'deleted', 'dependency', id).catch(() => {});
    broadcastBoardUpdate(projectId, 'dependency-deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/dependencies error:', error);
    return NextResponse.json({ error: 'Failed to delete dependency' }, { status: 500 });
  }
}