import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';
import { authenticate, getMemberRole, AuthError } from '@/lib/auth';

// POST /api/note-connections — create a connection (note → task|sprint|release)
export async function POST(req: NextRequest) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { noteId, toType, toId, projectId } = body;
    if (!noteId || !toType || !toId) {
      return NextResponse.json(
        { error: 'noteId, toType, and toId are required' },
        { status: 400 }
      );
    }
    if (!['task', 'sprint', 'release'].includes(toType)) {
      return NextResponse.json(
        { error: 'toType must be one of: task, sprint, release' },
        { status: 400 }
      );
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Only owner/editor can create note connections
    const role = await getMemberRole(projectId, session.memberId);
    if (role === 'viewer' || role === null) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const conn = await q.createNoteConnection({ noteId, toType, toId });
    q.logActivity(projectId, session.memberId, 'created', 'note-connection', conn.id, `${noteId}→${toType}:${toId}`).catch(() => {});
    broadcastBoardUpdate(projectId, 'note-connection-created');
    return NextResponse.json(conn);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/note-connections error:', error);
    return NextResponse.json(
      { error: 'Failed to create note connection' },
      { status: 500 }
    );
  }
}

// DELETE /api/note-connections — delete a connection by id
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

    // Only owner/editor can delete note connections
    const role = await getMemberRole(projectId, session.memberId);
    if (role === 'viewer' || role === null) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await q.deleteNoteConnection(id);
    q.logActivity(projectId, session.memberId, 'deleted', 'note-connection', id).catch(() => {});
    broadcastBoardUpdate(projectId, 'note-connection-deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/note-connections error:', error);
    return NextResponse.json(
      { error: 'Failed to delete note connection' },
      { status: 500 }
    );
  }
}