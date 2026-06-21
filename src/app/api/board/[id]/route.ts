import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireAuth, getMemberRole, AuthError } from '@/lib/auth';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';

// PATCH /api/board/[id] — rename a board (owner only)
// Body: { name: string, projectId?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id: boardId } = await params;
    const { name, projectId } = await req.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Board name is required' }, { status: 400 });
    }

    // Owner-only: check role if we have a projectId
    if (projectId) {
      const role = await getMemberRole(projectId, session.memberId);
      if (role !== 'owner') {
        return NextResponse.json({ error: 'Only project owners can rename boards' }, { status: 403 });
      }
    }

    await q.updateBoardName(boardId, name.trim());
    broadcastBoardUpdate(projectId, 'board-renamed');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PATCH /api/board/[id] error:', error);
    return NextResponse.json({ error: 'Failed to rename board' }, { status: 500 });
  }
}