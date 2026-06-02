import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    await q.updateSprint({ id, ...body });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/sprints/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update sprint' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await q.deleteSprint(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sprints/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete sprint' }, { status: 500 });
  }
}