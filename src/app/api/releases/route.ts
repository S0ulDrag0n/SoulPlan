import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import * as q from '@/lib/queries';

export async function POST(req: NextRequest) {
  try {
    const { boardId, name } = await req.json();
    if (!boardId || !name) {
      return NextResponse.json({ error: 'boardId and name required' }, { status: 400 });
    }
    const row = getDb().prepare('SELECT COALESCE(MAX(position), -1) + 1 as pos FROM releases WHERE board_id = ?').get(boardId) as { pos: number };
    const release = q.createRelease(boardId, name, row.pos);
    return NextResponse.json(release);
  } catch (error) {
    console.error('POST /api/releases error:', error);
    return NextResponse.json({ error: 'Failed to create release' }, { status: 500 });
  }
}