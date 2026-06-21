import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { boardId, text, x, y, color, projectId } = body;
    if (!boardId || typeof x !== 'number' || typeof y !== 'number') {
      return NextResponse.json(
        { error: 'boardId, x, and y are required' },
        { status: 400 }
      );
    }
    const note = await q.createStickyNote({ boardId, text, x, y, color });
    broadcastBoardUpdate(projectId, 'sticky-note-created');
    return NextResponse.json(note);
  } catch (error) {
    console.error('POST /api/sticky-notes error:', error);
    return NextResponse.json({ error: 'Failed to create sticky note' }, { status: 500 });
  }
}