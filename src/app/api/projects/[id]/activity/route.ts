import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireAuth, getMemberRole } from '@/lib/auth';

// GET /api/projects/[id]/activity?limit=50&offset=0
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: projectId } = await params;
    const role = await getMemberRole(projectId, session.memberId);
    if (!role) return NextResponse.json({ error: 'Not a project member' }, { status: 403 });

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

    const entries = await q.getActivity(projectId, limit, offset);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('GET /api/projects/[id]/activity error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}