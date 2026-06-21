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
    await q.updateStickyNote({ id, ...body });
    broadcastBoardUpdate(projectId, 'sticky-note-updated');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/sticky-notes/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update sticky note' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { projectId } = await req.json().catch(() => ({}));
    await q.deleteStickyNote(id);
    broadcastBoardUpdate(projectId, 'sticky-note-deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sticky-notes/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete sticky note' }, { status: 500 });
  }
}