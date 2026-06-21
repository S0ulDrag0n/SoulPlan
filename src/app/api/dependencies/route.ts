import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';

// POST /api/dependencies — create a dependency (fromTaskId → toTaskId meaning "from blocks to")
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromTaskId, toTaskId, projectId } = body;
    if (!fromTaskId || !toTaskId) {
      return NextResponse.json({ error: 'fromTaskId and toTaskId required' }, { status: 400 });
    }
    if (fromTaskId === toTaskId) {
      return NextResponse.json({ error: 'Cannot create self-referencing dependency' }, { status: 400 });
    }
    // Check for duplicate dependency
    const existing = await q.findDependency(fromTaskId, toTaskId);
    if (existing) {
      return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
    }
    const dep = await q.createDependency(fromTaskId, toTaskId);
    broadcastBoardUpdate(projectId, 'dependency-created');
    return NextResponse.json(dep);
  } catch (error) {
    console.error('POST /api/dependencies error:', error);
    return NextResponse.json({ error: 'Failed to create dependency' }, { status: 500 });
  }
}

// DELETE /api/dependencies — delete a dependency by id
export async function DELETE(req: NextRequest) {
  try {
    const { id, projectId } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    await q.deleteDependency(id);
    broadcastBoardUpdate(projectId, 'dependency-deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/dependencies error:', error);
    return NextResponse.json({ error: 'Failed to delete dependency' }, { status: 500 });
  }
}