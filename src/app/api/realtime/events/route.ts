import { NextRequest } from 'next/server';
import { getEventBus } from '@/lib/realtime/EventBus';
import { authenticate } from '@/lib/auth';
import { randomUUID } from 'crypto';

// SSE endpoint — GET /api/realtime/events?projectId=XXX
// Client connects via EventSource. Server keeps connection open and pushes events.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return new Response(JSON.stringify({ error: 'projectId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authenticate — only logged-in users/guests can connect to realtime
  // EventSource can't send custom headers, so accept token as query param too
  const token = searchParams.get('token');
  let session = await authenticate(req);
  if (!session && token) {
    // Try token from query param
    const { getSessionByToken } = await import('@/lib/queries');
    session = await getSessionByToken(token);
  }
  if (!session) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const bus = getEventBus();
  const clientId = randomUUID();
  const memberId = session.memberId;
  const memberName = session.displayName;

  const stream = new ReadableStream({
    start(controller) {
      // Register this client with the EventBus
      const disconnect = bus.connect(clientId, projectId, memberId, memberName, controller);

      // Send an initial comment to establish the connection
      controller.enqueue(': connected\n\n');

      // Send current presence list
      const present = bus.getPresence(projectId);
      controller.enqueue(`data: ${JSON.stringify({ type: 'presence-list', members: present })}\n\n`);

      // Clean up on abort/close
      req.signal.addEventListener('abort', () => {
        disconnect();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable proxy buffering (nginx)
    },
  });
}