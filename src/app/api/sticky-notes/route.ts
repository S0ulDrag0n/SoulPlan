import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { boardId, text, x, y, color, projectId } = body;
    if (!boardId || typeof x !== 'number' || typeof y !== 'number') {
      return NextResponse.json(
        { error: 'boardId, x, and y are required' },
        { status: 400 }
      );
    }
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    const note = await q.createStickyNote({ boardId, text, x, y, color });
    broadcastBoardUpdate(projectId, 'sticky-note-created');
    q.logActivity(projectId, session.memberId, 'created', 'note', note.id, text?.slice(0, 50)).catch(() => {});
    return NextResponse.json(note);
  } catch (error) {
    console.error('POST /api/sticky-notes error:', error);
    return NextResponse.json({ error: 'Failed to create sticky note' }, { status: 500 });
  }
}