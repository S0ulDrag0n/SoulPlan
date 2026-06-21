import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';

// POST /api/note-connections — create a connection (note → task|sprint|release)
export async function POST(req: NextRequest) {
  try {
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
    const conn = await q.createNoteConnection({ noteId, toType, toId });
    broadcastBoardUpdate(projectId, 'note-connection-created');
    return NextResponse.json(conn);
  } catch (error) {
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
    const { id, projectId } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    await q.deleteNoteConnection(id);
    broadcastBoardUpdate(projectId, 'note-connection-deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/note-connections error:', error);
    return NextResponse.json(
      { error: 'Failed to delete note connection' },
      { status: 500 }
    );
  }
}