import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireAuth, getMemberRole } from '@/lib/auth';

// GET /api/projects/[id]/jira/sync-log — get sync logs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const logs = await q.getSyncLogs(id);
    return NextResponse.json(logs);
  } catch (error) {
    console.error('GET jira/sync-log error:', error);
    return NextResponse.json({ error: 'Failed to get sync logs' }, { status: 500 });
  }
}