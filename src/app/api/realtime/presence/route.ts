import { NextRequest, NextResponse } from 'next/server';
import { getEventBus } from '@/lib/realtime/EventBus';
import { requireAuth, getMemberRole, AuthError } from '@/lib/auth';

// GET /api/realtime/presence?projectId=XXX — get current presence list
// NOTE: presence join/leave is handled automatically by SSE connect/disconnect
// in EventBus — no POST endpoint is needed.
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