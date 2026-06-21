import { getEventBus } from './EventBus';

/**
 * Broadcast a `board-update` event to all SSE clients connected to a project.
 *
 * Called by mutation API routes after a successful DB write so that every
 * connected collaborator (including the sender) reloads their board state.
 *
 * `projectId` is optional — if absent, no broadcast happens (backward compat
 * for callers that don't pass it).
 */
export function broadcastBoardUpdate(projectId: string | undefined | null, change: string): void {
  if (!projectId) return;
  const bus = getEventBus();
  bus.broadcast(projectId, { type: 'board-update', boardId: projectId, change });
}