import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';

// GET /api/projects/[id] — get a single project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await q.getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

// PATCH /api/projects/[id] — update a project
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.name !== undefined && typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 });
    }
    await q.updateProject({ id, ...body });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] — delete a project
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await q.deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}