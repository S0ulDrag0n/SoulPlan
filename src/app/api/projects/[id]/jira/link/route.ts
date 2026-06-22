import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireAuth, getMemberRole } from '@/lib/auth';

// POST /api/projects/[id]/jira/link — link a release/sprint/task to a Jira entity
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Editor+ required' }, { status: 403 });

    const body = await req.json();
    const { entityType, entityId, jiraId, jiraKey, jiraStatus } = body;

    if (entityType === 'release') {
      await q.linkReleaseToJira(entityId, jiraId);
    } else if (entityType === 'sprint') {
      await q.linkSprintToJira(entityId, jiraId);
    } else if (entityType === 'task') {
      await q.linkTaskToJira(entityId, jiraKey, jiraId ?? null, jiraStatus ?? null);
    } else {
      return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST jira/link error:', error);
    return NextResponse.json({ error: 'Failed to link' }, { status: 500 });
  }
}