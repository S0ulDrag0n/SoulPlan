import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getMemberRole } from '@/lib/auth';
import { getDb } from '@/lib/db/sqlite';
import { runSync } from '@/lib/jira/sync';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';

// POST /api/projects/[id]/jira/sync — run a manual sync
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Editor+ required' }, { status: 403 });

    const db = await getDb();
    const result = await runSync(db, id);
    broadcastBoardUpdate(id, 'jira-sync');
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST jira/sync error:', error);
    return NextResponse.json({ error: 'Sync failed: ' + (error as Error).message }, { status: 500 });
  }
}