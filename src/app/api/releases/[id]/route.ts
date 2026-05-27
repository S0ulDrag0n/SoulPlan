import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    await q.updateRelease({ id, ...body });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/releases/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update release' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await q.deleteRelease(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/releases/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete release' }, { status: 500 });
  }
}