import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireUser, AuthError } from '@/lib/auth';

// GET /api/projects — list projects. ?archived=true shows archived projects.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const archived = url.searchParams.get('archived') === 'true';
    const projects = archived
      ? await q.getArchivedProjects()
      : await q.getProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

// POST /api/projects — create a new project (users only, guests get 403)
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser(req);
    const { name } = await req.json();
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }
    const project = await q.createProject({ name }, session.memberId);
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}