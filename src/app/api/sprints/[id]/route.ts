import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';
import { authenticate, getMemberRole, AuthError } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { projectId, ...body } = await req.json();
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Only owner/editor can update sprints
    const role = await getMemberRole(projectId, session.memberId);
    if (role === 'viewer' || role === null) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await q.updateSprint({ id, ...body });
    broadcastBoardUpdate(projectId, 'sprint-updated');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PATCH /api/sprints/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update sprint' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Only owner/editor can delete sprints
    const role = await getMemberRole(projectId, session.memberId);
    if (role === 'viewer' || role === null) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await q.deleteSprint(id);
    broadcastBoardUpdate(projectId, 'sprint-deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/sprints/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete sprint' }, { status: 500 });
  }
}