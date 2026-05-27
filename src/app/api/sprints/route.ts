import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';

export async function POST(req: NextRequest) {
  try {
    const { releaseId, name } = await req.json();
    if (!releaseId || !name) {
      return NextResponse.json({ error: 'releaseId and name required' }, { status: 400 });
    }
    const sprint = await q.createSprint({ releaseId, name });
    return NextResponse.json(sprint);
  } catch (error) {
    console.error('POST /api/sprints error:', error);
    return NextResponse.json({ error: 'Failed to create sprint' }, { status: 500 });
  }
}