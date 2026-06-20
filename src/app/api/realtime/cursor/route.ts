import { NextRequest, NextResponse } from 'next/server';
import { getEventBus } from '@/lib/realtime/EventBus';
import { requireAuth, AuthError } from '@/lib/auth';

// POST /api/realtime/cursor — broadcast cursor position
// Body: { projectId, x, y }
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { projectId, x, y } = await req.json();

    if (!projectId || typeof x !== 'number' || typeof y !== 'number') {
      return NextResponse.json({ error: 'projectId, x, and y required' }, { status: 400 });
    }

    const bus = getEventBus();
    bus.broadcast(projectId, {
      type: 'cursor',
      memberId: session.memberId,
      memberName: session.displayName,
      x,
      y,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/realtime/cursor error:', error);
    return NextResponse.json({ error: 'Failed to broadcast cursor' }, { status: 500 });
  }
}