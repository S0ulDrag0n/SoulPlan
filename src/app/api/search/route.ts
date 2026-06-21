import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireAuth, AuthError } from '@/lib/auth';

// GET /api/search?q=...&projectId=...
// Searches task titles (case-insensitive, partial match) within a project.
// Returns matches with release/sprint context for the results dropdown.
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') ?? '';
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Verify the caller is a member of the project (any role can search).
    const role = await (await import('@/lib/auth')).getMemberRole(projectId, session.memberId);
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    const results = await q.searchTasks(projectId, query);
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}