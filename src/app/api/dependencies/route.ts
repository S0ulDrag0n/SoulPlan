import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/dependencies — create a dependency
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromTaskId, toTaskId } = body;

    if (!fromTaskId || !toTaskId) {
      return NextResponse.json({ error: 'fromTaskId and toTaskId are required' }, { status: 400 });
    }
    if (fromTaskId === toTaskId) {
      return NextResponse.json({ error: 'Cannot create self-referencing dependency' }, { status: 400 });
    }

    const dependency = await prisma.dependency.create({
      data: { fromTaskId, toTaskId },
    });
    return NextResponse.json(dependency, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/dependencies?id=xxx — delete a dependency
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }
    await prisma.dependency.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}