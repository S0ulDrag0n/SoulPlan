import { NextResponse } from 'next/server';
import * as q from '@/lib/queries';

export function GET() {
  try {
    const state = q.getOrCreateDefaultBoard();
    return NextResponse.json(state);
  } catch (error) {
    console.error('GET /api/board error:', error);
    return NextResponse.json({ error: 'Failed to load board' }, { status: 500 });
  }
}