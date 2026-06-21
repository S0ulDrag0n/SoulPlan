import { NextRequest, NextResponse } from 'next/server';
import { getEventBus } from '@/lib/realtime/EventBus';
import { requireAuth, AuthError } from '@/lib/auth';

// POST /api/realtime/editing — broadcast editing indicator
// Body: { projectId, target: 'task' | 'sprint' | 'release', targetId }
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { projectId, target, targetId } = await req.json();

    if (!projectId || !target || !targetId) {
      return NextResponse.json({ error: 'projectId, target, and targetId required' }, { status: 400 });
    }

    if (!['task', 'sprint', 'release'].includes(target)) {
      return NextResponse.json({ error: 'target must be task, sprint, or release' }, { status: 400 });
    }

    const bus = getEventBus();
    bus.broadcast(projectId, {
      type: 'editing',
      memberId: session.memberId,
      memberName: session.displayName,
      target,
      targetId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/realtime/editing error:', error);
    return NextResponse.json({ error: 'Failed to broadcast editing indicator' }, { status: 500 });
  }
}