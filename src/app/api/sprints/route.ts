import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import * as q from '@/lib/queries';

export async function POST(req: NextRequest) {
  try {
    const { releaseId, name } = await req.json();
    if (!releaseId || !name) {
      return NextResponse.json({ error: 'releaseId and name required' }, { status: 400 });
    }
    const row = getDb().prepare('SELECT COALESCE(MAX(position), -1) + 1 as pos FROM sprints WHERE release_id = ?').get(releaseId) as { pos: number };
    const sprint = q.createSprint(releaseId, name, row.pos);
    return NextResponse.json(sprint);
  } catch (error) {
    console.error('POST /api/sprints error:', error);
    return NextResponse.json({ error: 'Failed to create sprint' }, { status: 500 });
  }
}