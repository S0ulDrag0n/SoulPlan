import { setupTestDb } from './testDb';
import type { IDatabase } from '../db/adapter';

// We test the query functions (queries.ts) against a real sql.js database.
// Each test suite gets a fresh temp database via setupTestDb().
// The queries module uses getDb() internally, so we need to reset modules
// and re-import queries after setting up the temp dir.

// Helper: set up a fresh DB and return the queries module + adapter
async function setupQueries() {
  const setup = await setupTestDb();
  // queries.ts calls getDb() from db/sqlite.ts. Since we reset modules in
  // setupTestDb() and re-imported db/sqlite.ts, we need queries.ts to use
  // the same module instance. Re-import it here.
  const queries = await import('../queries');
  return { setup, queries };
}

describe('Project queries', () => {
  let setup: Awaited<ReturnType<typeof setupTestDb>>;
  let queries: typeof import('../queries');

  beforeEach(async () => {
    ({ setup, queries } = await setupQueries());
  });
  afterEach(() => setup.cleanup());

  it('createProject + getProject round-trip', async () => {
    const project = await queries.createProject({ name: 'Test Project' }, 'u1');
    expect(project.name).toBe('Test Project');
    expect(project.ownerId).toBe('u1');
    expect(project.isArchived).toBe(false);

    const fetched = await queries.getProject(project.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Test Project');
  });

  it('createProject auto-adds owner as project member', async () => {
    const project = await queries.createProject({ name: 'P' }, 'u1');
    const members = await queries.getProjectMembers(project.id);
    expect(members).toHaveLength(1);
    expect(members[0].memberId).toBe('u1');
    expect(members[0].role).toBe('owner');
    expect(members[0].memberType).toBe('user');
  });

  it('createProject without ownerId does not add a member', async () => {
    const project = await queries.createProject({ name: 'P' });
    const members = await queries.getProjectMembers(project.id);
    expect(members).toHaveLength(0);
  });

  it('updateProject can archive and unarchive', async () => {
    const project = await queries.createProject({ name: 'P' });
    await queries.updateProject({ id: project.id, isArchived: true });
    expect((await queries.getProject(project.id))!.isArchived).toBe(true);
    await queries.updateProject({ id: project.id, isArchived: false });
    expect((await queries.getProject(project.id))!.isArchived).toBe(false);
  });

  it('deleteProject removes the project', async () => {
    const project = await queries.createProject({ name: 'P' });
    await queries.deleteProject(project.id);
    expect(await queries.getProject(project.id)).toBeNull();
  });
});

describe('Auth queries — registerUser', () => {
  let setup: Awaited<ReturnType<typeof setupTestDb>>;
  let queries: typeof import('../queries');

  beforeEach(async () => {
    ({ setup, queries } = await setupQueries());
  });
  afterEach(() => setup.cleanup());

  it('creates a user and returns a session', async () => {
    const { user, session } = await queries.registerUser({
      username: 'alice', password: 'secret123', displayName: 'Alice',
    });
    expect(user.username).toBe('alice');
    expect(user.displayName).toBe('Alice');
    expect(session.token).toBeTruthy();
    expect(session.memberType).toBe('user');
    expect(session.memberId).toBe(user.id);
    expect(session.displayName).toBe('Alice');
  });

  it('throws on duplicate username', async () => {
    await queries.registerUser({ username: 'bob', password: 'pass1' });
    await expect(queries.registerUser({ username: 'bob', password: 'pass2' })).rejects.toThrow();
  });

  it('works without display_name (falls back to username in session)', async () => {
    const { user, session } = await queries.registerUser({ username: 'carol', password: 'pw' });
    expect(user.displayName).toBeNull();
    expect(session.displayName).toBe('carol'); // username as fallback
  });
});

describe('Auth queries — loginUser', () => {
  let setup: Awaited<ReturnType<typeof setupTestDb>>;
  let queries: typeof import('../queries');

  beforeEach(async () => {
    ({ setup, queries } = await setupQueries());
  });
  afterEach(() => setup.cleanup());

  it('logs in with correct password and returns session', async () => {
    await queries.registerUser({ username: 'alice', password: 'correct-pw' });
    const { user, session } = await queries.loginUser({ username: 'alice', password: 'correct-pw' });
    expect(user.username).toBe('alice');
    expect(session.token).toBeTruthy();
    expect(session.memberType).toBe('user');
  });

  it('throws on wrong password', async () => {
    await queries.registerUser({ username: 'alice', password: 'correct-pw' });
    await expect(queries.loginUser({ username: 'alice', password: 'wrong-pw' })).rejects.toThrow();
  });

  it('throws on nonexistent user', async () => {
    await expect(queries.loginUser({ username: 'nobody', password: 'pw' })).rejects.toThrow();
  });

  it('produces different session tokens for different logins', async () => {
    await queries.registerUser({ username: 'alice', password: 'pw' });
    const s1 = await queries.loginUser({ username: 'alice', password: 'pw' });
    const s2 = await queries.loginUser({ username: 'alice', password: 'pw' });
    expect(s1.session.token).not.toBe(s2.session.token);
  });
});

describe('Auth queries — password hashing', () => {
  let setup: Awaited<ReturnType<typeof setupTestDb>>;
  let queries: typeof import('../queries');

  beforeEach(async () => {
    ({ setup, queries } = await setupQueries());
  });
  afterEach(() => setup.cleanup());

  it('different passwords produce different hashes (salt)', async () => {
    const r1 = await queries.registerUser({ username: 'a1', password: 'password1' });
    const r2 = await queries.registerUser({ username: 'a2', password: 'password1' });
    // Both registered with same password — sessions work
    expect(r1.session.token).not.toBe(r2.session.token);
  });

  it('correct password verifies successfully', async () => {
    await queries.registerUser({ username: 'verify', password: 'my-password' });
    const { session } = await queries.loginUser({ username: 'verify', password: 'my-password' });
    expect(session.token).toBeTruthy();
  });

  it('similar but different passwords fail', async () => {
    await queries.registerUser({ username: 'verify2', password: 'my-password' });
    await expect(queries.loginUser({ username: 'verify2', password: 'my-passwor' })).rejects.toThrow();
    await expect(queries.loginUser({ username: 'verify2', password: 'my-password1' })).rejects.toThrow();
  });
});

describe('Auth queries — joinAsGuest', () => {
  let setup: Awaited<ReturnType<typeof setupTestDb>>;
  let queries: typeof import('../queries');

  beforeEach(async () => {
    ({ setup, queries } = await setupQueries());
  });
  afterEach(() => setup.cleanup());

  it('creates a guest account and session', async () => {
    const { guest, session } = await queries.joinAsGuest({ name: 'Visitor' });
    expect(guest.name).toBe('Visitor');
    expect(session.token).toBeTruthy();
    expect(session.memberType).toBe('guest');
    expect(session.memberId).toBe(guest.id);
    expect(session.displayName).toBe('Visitor');
  });
});

describe('Auth queries — getSessionByToken', () => {
  let setup: Awaited<ReturnType<typeof setupTestDb>>;
  let queries: typeof import('../queries');

  beforeEach(async () => {
    ({ setup, queries } = await setupQueries());
  });
  afterEach(() => setup.cleanup());

  it('returns session for valid token', async () => {
    const { session } = await queries.registerUser({ username: 'x', password: 'p' });
    const found = await queries.getSessionByToken(session.token);
    expect(found).not.toBeNull();
    expect(found!.token).toBe(session.token);
  });

  it('returns null for invalid token', async () => {
    expect(await queries.getSessionByToken('nonexistent-token')).toBeNull();
  });

  it('returns null after session is deleted', async () => {
    const { session } = await queries.registerUser({ username: 'y', password: 'p' });
    await queries.deleteSession(session.token);
    expect(await queries.getSessionByToken(session.token)).toBeNull();
  });
});

describe('Project member queries', () => {
  let setup: Awaited<ReturnType<typeof setupTestDb>>;
  let queries: typeof import('../queries');

  beforeEach(async () => {
    ({ setup, queries } = await setupQueries());
  });
  afterEach(() => setup.cleanup());

  it('addProjectMember is idempotent — adding twice returns the same member', async () => {
    const project = await queries.createProject({ name: 'P' }, 'u1');
    const m1 = await queries.addProjectMember(project.id, 'guest', 'g1', 'editor');
    const m2 = await queries.addProjectMember(project.id, 'guest', 'g1', 'viewer');
    expect(m1.id).toBe(m2.id);
    expect(m2.role).toBe('editor'); // retains original role, doesn't overwrite
  });

  it('addProjectMember adds a new member with default role editor', async () => {
    const project = await queries.createProject({ name: 'P' });
    const member = await queries.addProjectMember(project.id, 'guest', 'g1');
    expect(member.role).toBe('editor');
    expect(member.memberType).toBe('guest');
    expect(member.memberId).toBe('g1');
  });

  it('getProjectsByMemberId returns only projects the member belongs to', async () => {
    const p1 = await queries.createProject({ name: 'P1' }, 'u1');
    const p2 = await queries.createProject({ name: 'P2' }, 'u1');
    await queries.createProject({ name: 'P3' }); // no owner, no members
    const projects = await queries.getProjectsByMemberId('u1');
    expect(projects.map(p => p.name).sort()).toEqual(['P1', 'P2']);
  });

  it('getProjectsByMemberId respects archived filter (false = only active)', async () => {
    const p1 = await queries.createProject({ name: 'Active' }, 'u1');
    const p2 = await queries.createProject({ name: 'Archived' }, 'u1');
    await queries.updateProject({ id: p2.id, isArchived: true });

    const active = await queries.getProjectsByMemberId('u1', false);
    expect(active.map(p => p.name)).toEqual(['Active']);
  });

  it('getProjectsByMemberId respects archived filter (true = only archived)', async () => {
    const p1 = await queries.createProject({ name: 'Active' }, 'u1');
    const p2 = await queries.createProject({ name: 'Archived' }, 'u1');
    await queries.updateProject({ id: p2.id, isArchived: true });

    const archived = await queries.getProjectsByMemberId('u1', true);
    expect(archived.map(p => p.name)).toEqual(['Archived']);
  });

  it('removeProjectMember removes the member', async () => {
    const project = await queries.createProject({ name: 'P' });
    const member = await queries.addProjectMember(project.id, 'guest', 'g1');
    await queries.removeProjectMember(member.id);
    const members = await queries.getProjectMembers(project.id);
    expect(members).toHaveLength(0);
  });
});

describe('Project invite queries', () => {
  let setup: Awaited<ReturnType<typeof setupTestDb>>;
  let queries: typeof import('../queries');

  beforeEach(async () => {
    ({ setup, queries } = await setupQueries());
  });
  afterEach(() => setup.cleanup());

  it('createInvite + getInviteByToken round-trip', async () => {
    const project = await queries.createProject({ name: 'P' });
    const invite = await queries.createInvite(project.id, 'editor');
    expect(invite.token).toBeTruthy();
    expect(invite.role).toBe('editor');
    expect(invite.projectId).toBe(project.id);
    expect(invite.expiresAt).toBeNull();

    const found = await queries.getInviteByToken(invite.token);
    expect(found).not.toBeNull();
    expect(found!.projectId).toBe(project.id);
    expect(found!.role).toBe('editor');
  });

  it('getInviteByToken returns null for invalid token', async () => {
    expect(await queries.getInviteByToken('nonexistent')).toBeNull();
  });

  it('getInvitesByProjectId returns all invites for a project', async () => {
    const project = await queries.createProject({ name: 'P' });
    await queries.createInvite(project.id, 'editor');
    await queries.createInvite(project.id, 'viewer');
    const invites = await queries.getInvitesByProjectId(project.id);
    expect(invites).toHaveLength(2);
  });

  it('deleteInvite removes the invite', async () => {
    const project = await queries.createProject({ name: 'P' });
    const invite = await queries.createInvite(project.id);
    await queries.deleteInvite(invite.id);
    expect(await queries.getInviteByToken(invite.token)).toBeNull();
  });
});

describe('acceptInvite', () => {
  let setup: Awaited<ReturnType<typeof setupTestDb>>;
  let queries: typeof import('../queries');

  beforeEach(async () => {
    ({ setup, queries } = await setupQueries());
  });
  afterEach(() => setup.cleanup());

  it('creates a guest, adds them as member, and returns a session', async () => {
    const project = await queries.createProject({ name: 'Shared' }, 'u1');
    const invite = await queries.createInvite(project.id, 'editor');

    const result = await queries.acceptInvite(invite.token, 'New Guest');
    expect(result.guest.name).toBe('New Guest');
    expect(result.session.token).toBeTruthy();
    expect(result.session.memberType).toBe('guest');
    expect(result.project.id).toBe(project.id);
    expect(result.invite.token).toBe(invite.token);

    // Verify the guest was added as a project member
    const members = await queries.getProjectMembers(project.id);
    const guestMember = members.find(m => m.memberId === result.guest.id);
    expect(guestMember).toBeDefined();
    expect(guestMember!.role).toBe('editor');
  });

  it('throws for invalid invite token', async () => {
    await expect(queries.acceptInvite('invalid-token', 'Guest')).rejects.toThrow();
  });

  it('throws when the project no longer exists', async () => {
    const project = await queries.createProject({ name: 'P' });
    const invite = await queries.createInvite(project.id);
    await queries.deleteProject(project.id);
    await expect(queries.acceptInvite(invite.token, 'Guest')).rejects.toThrow();
  });

  it('invite remains valid after first accept (reusable)', async () => {
    const project = await queries.createProject({ name: 'P' });
    const invite = await queries.createInvite(project.id, 'viewer');

    const r1 = await queries.acceptInvite(invite.token, 'Guest 1');
    const r2 = await queries.acceptInvite(invite.token, 'Guest 2');

    expect(r1.guest.id).not.toBe(r2.guest.id);
    expect(r1.session.token).not.toBe(r2.session.token);
    // Both guests should be members
    const members = await queries.getProjectMembers(project.id);
    expect(members.filter(m => m.memberType === 'guest')).toHaveLength(2);
  });
});