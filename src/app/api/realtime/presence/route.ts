import { NextRequest, NextResponse } from 'next/server';
import { getEventBus } from '@/lib/realtime/EventBus';
import { requireAuth, getMemberRole, AuthError } from '@/lib/auth';

// POST /api/realtime/presence — heartbeat / join / leave
// Body: { projectId, action: 'join' | 'leave' }
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { projectId, action } = await req.json();

    if (!projectId || !action) {
      return NextResponse.json({ error: 'projectId and action required' }, { status: 400 });
    }

    if (action !== 'join' && action !== 'leave') {
      return NextResponse.json({ error: 'action must be join or leave' }, { status: 400 });
    }

    const bus = getEventBus();
    bus.broadcast(projectId, {
      type: 'presence',
      memberId: session.memberId,
      memberName: session.displayName,
      action,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/realtime/presence error:', error);
    return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
  }
}

// GET /api/realtime/presence?projectId=XXX — get current presence list
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Must be a member to view presence
    const role = await getMemberRole(projectId, session.memberId);
    if (role === null) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    const bus = getEventBus();
    const members = bus.getPresence(projectId);
    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/realtime/presence error:', error);
    return NextResponse.json({ error: 'Failed to get presence' }, { status: 500 });
  }
}