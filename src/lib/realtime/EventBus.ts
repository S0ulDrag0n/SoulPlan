/**
 * EventBus — in-memory singleton for realtime collaboration.
 *
 * Maintains a map of project → connected SSE clients.
 * When a client sends a cursor/presence/editing event via POST,
 * the EventBus broadcasts it to all SSE connections for that project.
 *
 * This is server-side only. It does NOT persist across server restarts
 * (in-memory, no DB), which is fine for presence/cursor events.
 */

export type RealtimeEvent =
  | { type: 'cursor'; memberId: string; memberName: string; x: number; y: number }
  | { type: 'presence'; memberId: string; memberName: string; action: 'join' | 'leave' }
  | { type: 'editing'; memberId: string; memberName: string; target: 'task' | 'sprint' | 'release'; targetId: string }
  | { type: 'board-update'; boardId: string; change: string };

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
  projectId: string;
  memberId: string;
  memberName: string;
};

class EventBus {
  private clients = new Map<string, SSEClient>();

  /** Register a new SSE client for a project. Returns a cleanup function. */
  connect(
    id: string,
    projectId: string,
    memberId: string,
    memberName: string,
    controller: ReadableStreamDefaultController
  ): () => void {
    const client: SSEClient = { id, controller, projectId, memberId, memberName };
    this.clients.set(id, client);

    // Broadcast a presence:join event to other clients on the same project
    this.broadcast(projectId, {
      type: 'presence',
      memberId,
      memberName,
      action: 'join',
    }, id); // exclude sender

    return () => {
      this.clients.delete(id);
      // Broadcast presence:leave
      this.broadcast(projectId, {
        type: 'presence',
        memberId,
        memberName,
        action: 'leave',
      });
    };
  }

  /** Broadcast an event to all SSE clients connected to a project. */
  broadcast(projectId: string, event: RealtimeEvent, excludeClientId?: string): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients.values()) {
      if (client.projectId !== projectId) continue;
      if (excludeClientId && client.id === excludeClientId) continue;
      try {
        client.controller.enqueue(data);
      } catch {
        // Client may have disconnected — clean up
        this.clients.delete(client.id);
      }
    }
  }

  /** Get all connected members for a project (for presence). */
  getPresence(projectId: string): { memberId: string; memberName: string }[] {
    const result: { memberId: string; memberName: string }[] = [];
    for (const client of this.clients.values()) {
      if (client.projectId === projectId) {
        result.push({ memberId: client.memberId, memberName: client.memberName });
      }
    }
    return result;
  }

  /** Get the count of connected clients (for diagnostics). */
  get clientCount(): number {
    return this.clients.size;
  }
}

// Singleton — persists across requests in the same Node.js process.
// In serverless/edge environments, each instance would have its own bus,
// but for a single-process Next.js server this works correctly.
let eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}