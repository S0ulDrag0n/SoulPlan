import { getTokenFromRequest, AuthError, requireAuth, requireUser, getMemberRole } from '../auth';
import type { Session } from '../types';

// Mock the queries module — auth.ts imports getSessionByToken from queries,
// and getMemberRole dynamically imports the DB.
jest.mock('../queries', () => ({
  getSessionByToken: jest.fn(),
}));

const queries = jest.requireMock('../queries') as { getSessionByToken: jest.Mock };

// ─── Helpers ──────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/test', { headers });
}

const userSession: Session = {
  token: 'valid-user-token',
  memberType: 'user',
  memberId: 'u1',
  displayName: 'Alice',
};

const guestSession: Session = {
  token: 'valid-guest-token',
  memberType: 'guest',
  memberId: 'g1',
  displayName: 'Bob',
};

// ─── getTokenFromRequest ──────────────────────────────────

describe('getTokenFromRequest', () => {
  it('extracts token from valid Bearer header', () => {
    const req = makeRequest({ authorization: 'Bearer my-token-123' });
    expect(getTokenFromRequest(req)).toBe('my-token-123');
  });

  it('returns null when Authorization header is missing', () => {
    expect(getTokenFromRequest(makeRequest())).toBeNull();
  });

  it('returns null for malformed header (no "Bearer" prefix)', () => {
    expect(getTokenFromRequest(makeRequest({ authorization: 'my-token-123' }))).toBeNull();
  });

  it('returns null for empty header value', () => {
    expect(getTokenFromRequest(makeRequest({ authorization: '' }))).toBeNull();
  });

  it('is case-insensitive for the "Bearer" prefix', () => {
    const req = makeRequest({ authorization: 'bearer my-token' });
    expect(getTokenFromRequest(req)).toBe('my-token');
  });

  it('handles extra whitespace after Bearer', () => {
    const req = makeRequest({ authorization: 'Bearer   my-token' });
    expect(getTokenFromRequest(req)).toBe('my-token');
  });

  it('returns null for "Bearer" with no token after it', () => {
    // The regex /^Bearer\s+(.+)$/i requires at least one char after spaces
    expect(getTokenFromRequest(makeRequest({ authorization: 'Bearer ' }))).toBeNull();
  });
});

// ─── AuthError ────────────────────────────────────────────

describe('AuthError', () => {
  it('has the correct statusCode and message', () => {
    const err = new AuthError('Not allowed', 403);
    expect(err.message).toBe('Not allowed');
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe('AuthError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthError);
  });

  it('supports 401 for auth required', () => {
    const err = new AuthError('Authentication required', 401);
    expect(err.statusCode).toBe(401);
  });
});

// ─── requireAuth ─────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns session for valid user token', async () => {
    queries.getSessionByToken.mockResolvedValue(userSession);
    const req = makeRequest({ authorization: 'Bearer valid-user-token' });
    const session = await requireAuth(req);
    expect(session).toEqual(userSession);
    expect(queries.getSessionByToken).toHaveBeenCalledWith('valid-user-token');
  });

  it('returns session for valid guest token', async () => {
    queries.getSessionByToken.mockResolvedValue(guestSession);
    const req = makeRequest({ authorization: 'Bearer valid-guest-token' });
    const session = await requireAuth(req);
    expect(session).toEqual(guestSession);
  });

  it('throws AuthError(401) when Authorization header is missing', async () => {
    const req = makeRequest();
    await expect(requireAuth(req)).rejects.toThrow(AuthError);
    await expect(requireAuth(req)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws AuthError(401) when token is invalid/not found in DB', async () => {
    queries.getSessionByToken.mockResolvedValue(null);
    const req = makeRequest({ authorization: 'Bearer invalid-token' });
    await expect(requireAuth(req)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws AuthError(401) when token is malformed', async () => {
    const req = makeRequest({ authorization: 'not-a-bearer-header' });
    await expect(requireAuth(req)).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ─── requireUser ─────────────────────────────────────────

describe('requireUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns session for valid user session', async () => {
    queries.getSessionByToken.mockResolvedValue(userSession);
    const req = makeRequest({ authorization: 'Bearer valid-user-token' });
    const session = await requireUser(req);
    expect(session).toEqual(userSession);
  });

  it('throws AuthError(403) for guest session', async () => {
    queries.getSessionByToken.mockResolvedValue(guestSession);
    const req = makeRequest({ authorization: 'Bearer valid-guest-token' });
    await expect(requireUser(req)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws AuthError(401) when no token provided', async () => {
    const req = makeRequest();
    await expect(requireUser(req)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws AuthError(401) when token is invalid', async () => {
    queries.getSessionByToken.mockResolvedValue(null);
    const req = makeRequest({ authorization: 'Bearer bad-token' });
    await expect(requireUser(req)).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ─── getMemberRole ───────────────────────────────────────

// getMemberRole dynamically imports './db/sqlite', so we mock that module.
jest.mock('../db/sqlite', () => ({
  getDb: jest.fn(),
}));

const sqliteModule = jest.requireMock('../db/sqlite') as { getDb: jest.Mock };

describe('getMemberRole', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the role when the member is found', async () => {
    sqliteModule.getDb.mockResolvedValue({
      findProjectMember: jest.fn().mockResolvedValue({ role: 'editor' }),
    });
    const role = await getMemberRole('p1', 'u1');
    expect(role).toBe('editor');
  });

  it('returns null when the member is not found', async () => {
    sqliteModule.getDb.mockResolvedValue({
      findProjectMember: jest.fn().mockResolvedValue(undefined),
    });
    const role = await getMemberRole('p1', 'nonexistent');
    expect(role).toBeNull();
  });
});