import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { authenticate, getMemberRole, AuthError } from '@/lib/auth';

// GET /api/projects/[id] — get a single project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Must be a member to view project details
    const role = await getMemberRole(id, session.memberId);
    if (role === null) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    const project = await q.getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

// PATCH /api/projects/[id] — update a project (name, archive/unarchive)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Only owner can update project settings
    const role = await getMemberRole(id, session.memberId);
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only project owners can update settings' }, { status: 403 });
    }

    const body = await req.json();
    if (body.name !== undefined && typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 });
    }
    if (body.isArchived !== undefined && typeof body.isArchived !== 'boolean') {
      return NextResponse.json({ error: 'isArchived must be a boolean' }, { status: 400 });
    }
    await q.updateProject({ id, ...body });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PATCH /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] — delete a project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Only owner can delete project
    const role = await getMemberRole(id, session.memberId);
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only project owners can delete projects' }, { status: 403 });
    }

    await q.deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}