import * as q from './queries';
import type { Session, MemberRole } from './types';

/**
 * Auth helpers for API route handlers.
 * Session token is passed via the `Authorization: Bearer <token>` header.
 */

/** Extract the bearer token from a Request's Authorization header. */
export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Authenticate a request, returning the session if valid.
 * Returns null if no token or invalid session.
 */
export async function authenticate(req: Request): Promise<Session | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return q.getSessionByToken(token);
}

/**
 * Require authentication — throws an error if not authenticated.
 * Use in route handlers that need a logged-in user/guest.
 */
export async function requireAuth(req: Request): Promise<Session> {
  const session = await authenticate(req);
  if (!session) {
    throw new AuthError('Authentication required', 401);
  }
  return session;
}

/**
 * Require a user session (not a guest). Throws if the session is a guest.
 */
export async function requireUser(req: Request): Promise<Session> {
  const session = await requireAuth(req);
  if (session.memberType !== 'user') {
    throw new AuthError('User account required', 403);
  }
  return session;
}

/** Custom error with status code for auth failures. */
export class AuthError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Check if a member has a specific role in a project. Returns null if not a member. */
export async function getMemberRole(
  projectId: string,
  memberId: string
): Promise<MemberRole | null> {
  const { getDb } = await import('./db/sqlite');
  const db = await getDb();
  const row = await db.findProjectMember(projectId, memberId);
  return row ? row.role : null;
}