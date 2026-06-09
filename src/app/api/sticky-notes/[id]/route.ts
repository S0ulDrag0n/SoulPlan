import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    await q.updateStickyNote({ id, ...body });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/sticky-notes/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update sticky note' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await q.deleteStickyNote(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sticky-notes/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete sticky note' }, { status: 500 });
  }
}
