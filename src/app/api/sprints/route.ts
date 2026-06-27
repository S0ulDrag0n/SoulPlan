import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { releaseId, name, projectId } = await req.json();
    if (!releaseId || !name) {
      return NextResponse.json({ error: 'releaseId and name required' }, { status: 400 });
    }
    const sprint = await q.createSprint({ releaseId, name });
    broadcastBoardUpdate(projectId, 'sprint-created');
    q.logActivity(projectId, session.memberId, 'created', 'sprint', sprint.id, sprint.name).catch(() => {});
    return NextResponse.json(sprint);
  } catch (error) {
    console.error('POST /api/sprints error:', error);
    return NextResponse.json({ error: 'Failed to create sprint' }, { status: 500 });
  }
}