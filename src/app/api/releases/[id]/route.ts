import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { projectId, ...body } = await req.json();
    await q.updateRelease({ id, ...body });
    broadcastBoardUpdate(projectId, 'release-updated');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/releases/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update release' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { projectId } = await req.json().catch(() => ({}));
    await q.deleteRelease(id);
    broadcastBoardUpdate(projectId, 'release-deleted');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/releases/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete release' }, { status: 500 });
  }
}