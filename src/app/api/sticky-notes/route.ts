import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { boardId, text, x, y, color } = body;
    if (!boardId || typeof x !== 'number' || typeof y !== 'number') {
      return NextResponse.json(
        { error: 'boardId, x, and y are required' },
        { status: 400 }
      );
    }
    const note = await q.createStickyNote({ boardId, text, x, y, color });
    return NextResponse.json(note);
  } catch (error) {
    console.error('POST /api/sticky-notes error:', error);
    return NextResponse.json({ error: 'Failed to create sticky note' }, { status: 500 });
  }
}
