import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { boardId, name, projectId } = await req.json();
    if (!boardId || !name) {
      return NextResponse.json({ error: 'boardId and name required' }, { status: 400 });
    }
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    const release = await q.createRelease({ boardId, name });
    broadcastBoardUpdate(projectId, 'release-created');
    q.logActivity(projectId, session.memberId, 'created', 'release', release.id, release.name).catch(() => {});
    return NextResponse.json(release);
  } catch (error) {
    console.error('POST /api/releases error:', error);
    return NextResponse.json({ error: 'Failed to create release' }, { status: 500 });
  }
}