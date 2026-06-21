import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { authenticate, AuthError } from '@/lib/auth';

// GET /api/projects/[id]/export — download a full project snapshot as JSON.
//
// Returns the project row plus every board with its releases → sprints →
// tasks tree, dependencies, sticky notes, and note connections. All IDs are
// the ORIGINAL source IDs; the import path remaps them to fresh UUIDs.
//
// Access: any authenticated member of the project (owner/editor/viewer).
// We don't restrict to owner here — viewers can export too, since export is
// a read-only operation and the data is already visible to them in the UI.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authenticate(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id } = await params;

    // Verify the requester is a member of the project.
    const { getMemberRole } = await import('@/lib/auth');
    const role = await getMemberRole(id, session.memberId);
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    const exportData = await q.exportProject(id);
    if (!exportData) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="${exportData.project.name.replace(/[^a-zA-Z0-9-_]/g, '_')}-export.json"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/projects/[id]/export error:', error);
    return NextResponse.json({ error: 'Failed to export project' }, { status: 500 });
  }
}