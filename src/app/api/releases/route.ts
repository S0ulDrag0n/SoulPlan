import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';

export async function POST(req: NextRequest) {
  try {
    const { boardId, name, projectId } = await req.json();
    if (!boardId || !name) {
      return NextResponse.json({ error: 'boardId and name required' }, { status: 400 });
    }
    const release = await q.createRelease({ boardId, name });
    broadcastBoardUpdate(projectId, 'release-created');
    return NextResponse.json(release);
  } catch (error) {
    console.error('POST /api/releases error:', error);
    return NextResponse.json({ error: 'Failed to create release' }, { status: 500 });
  }
}