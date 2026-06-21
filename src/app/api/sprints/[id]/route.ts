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
    await q.updateSprint({ id, ...body });
    broadcastBoardUpdate(projectId, 'sprint-updated');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/sprints/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update sprint' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { projectId } = await req.json().catch(() => ({}));
    await q.deleteSprint(id);
    broadcastBoardUpdate(projectId, 'sprint-deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sprints/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete sprint' }, { status: 500 });
  }
}