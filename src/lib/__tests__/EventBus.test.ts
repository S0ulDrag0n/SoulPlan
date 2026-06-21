import { getEventBus, type RealtimeEvent } from '../realtime/EventBus';

// ─── Helpers ──────────────────────────────────────────────

/** Create a mock ReadableStreamDefaultController with an enqueue spy. */
function makeController(): {
  controller: ReadableStreamDefaultController;
  enqueue: jest.Mock;
} {
  const enqueue = jest.fn();
  const controller = {
    enqueue,
    close: jest.fn(),
    error: jest.fn(),
    desiredSize: 1,
  } as unknown as ReadableStreamDefaultController;
  return { controller, enqueue };
}

/** Reset the singleton between tests by manipulating the module. */
function resetEventBusSingleton(): void {
  // Force a fresh instance by calling connect+cleanup, then the next
  // getEventBus() returns a new one. Actually the singleton persists, so
  // we need a different approach: access the internal instance.
  // Simplest: just use a fresh instance by calling getEventBus() and
  // cleaning up all clients. But we can't access private state.
  // Instead, we test the singleton behavior separately.
}

describe('EventBus singleton', () => {
  it('returns the same instance across multiple calls', () => {
    const bus1 = getEventBus();
    const bus2 = getEventBus();
    expect(bus1).toBe(bus2);
  });
});

describe('EventBus.connect', () => {
  it('registers a client and broadcasts presence:join to others (excluding sender)', () => {
    const bus = getEventBus();
    // Set up an existing client on the same project first
    const existing = makeController();
    const cleanupExisting = bus.connect('c0', 'proj-1', 'm0', 'Alice', existing.controller);

    // Now connect a new client — should broadcast presence:join to existing
    const newClient = makeController();
    const cleanup = bus.connect('c1', 'proj-1', 'm1', 'Bob', newClient.controller);

    // The existing client should have received a presence:join for Bob
    expect(existing.enqueue).toHaveBeenCalledTimes(1);
    const data = existing.enqueue.mock.calls[0][0] as string;
    expect(data).toContain('presence');
    expect(data).toContain('Bob');
    expect(data).toContain('join');

    // The new client should NOT have received its own join (excluded sender)
    expect(newClient.enqueue).not.toHaveBeenCalled();

    cleanup();
    cleanupExisting();
  });

  it('does not broadcast to clients on a different project', () => {
    const bus = getEventBus();
    const projA = makeController();
    const cleanupA = bus.connect('cA', 'proj-A', 'mA', 'Alice', projA.controller);

    const projB = makeController();
    const cleanupB = bus.connect('cB', 'proj-B', 'mB', 'Bob', projB.controller);

    // projA should not have received projB's join
    // (projA only received nothing since it was the first client)
    const projACalls = projA.enqueue.mock.calls.length;
    // projB's join went only to proj-B clients, not proj-A
    const projBCalls = projB.enqueue.mock.calls.length;

    // Now broadcast to proj-A — projB should not receive it
    const event: RealtimeEvent = { type: 'cursor', memberId: 'mA', memberName: 'Alice', x: 10, y: 20 };
    bus.broadcast('proj-A', event);

    expect(projA.enqueue).toHaveBeenCalled();
    expect(projB.enqueue.mock.calls.length).toBe(projBCalls); // no new calls

    cleanupA();
    cleanupB();
  });

  it('returns a cleanup function that removes the client and broadcasts presence:leave', () => {
    const bus = getEventBus();
    const other = makeController();
    const cleanupOther = bus.connect('c-other', 'proj-leave', 'm0', 'Alice', other.controller);

    const client = makeController();
    const cleanup = bus.connect('c-leave', 'proj-leave', 'm1', 'Bob', client.controller);

    // Clear previous calls
    other.enqueue.mockClear();

    cleanup();

    // Other client should have received presence:leave for Bob
    expect(other.enqueue).toHaveBeenCalledTimes(1);
    const data = other.enqueue.mock.calls[0][0] as string;
    expect(data).toContain('leave');

    cleanupOther();
  });
});

describe('EventBus.broadcast', () => {
  it('delivers to all clients on the same project', () => {
    const bus = getEventBus();
    const c1 = makeController();
    const c2 = makeController();
    const cleanup1 = bus.connect('b1', 'proj-bc', 'm1', 'Alice', c1.controller);
    const cleanup2 = bus.connect('b2', 'proj-bc', 'm2', 'Bob', c2.controller);

    // Clear join broadcasts
    c1.enqueue.mockClear();
    c2.enqueue.mockClear();

    const event: RealtimeEvent = { type: 'cursor', memberId: 'm3', memberName: 'Carol', x: 5, y: 10 };
    bus.broadcast('proj-bc', event);

    expect(c1.enqueue).toHaveBeenCalledTimes(1);
    expect(c2.enqueue).toHaveBeenCalledTimes(1);

    cleanup1();
    cleanup2();
  });

  it('excludes a specific client by clientId', () => {
    const bus = getEventBus();
    const c1 = makeController();
    const c2 = makeController();
    const cleanup1 = bus.connect('ex1', 'proj-ex', 'm1', 'Alice', c1.controller);
    const cleanup2 = bus.connect('ex2', 'proj-ex', 'm2', 'Bob', c2.controller);

    c1.enqueue.mockClear();
    c2.enqueue.mockClear();

    const event: RealtimeEvent = { type: 'cursor', memberId: 'm1', memberName: 'Alice', x: 0, y: 0 };
    bus.broadcast('proj-ex', event, 'ex1'); // exclude c1

    expect(c1.enqueue).not.toHaveBeenCalled();
    expect(c2.enqueue).toHaveBeenCalledTimes(1);

    cleanup1();
    cleanup2();
  });

  it('does not deliver to clients on other projects', () => {
    const bus = getEventBus();
    const same = makeController();
    const other = makeController();
    const cleanupSame = bus.connect('s1', 'proj-same', 'm1', 'Alice', same.controller);
    const cleanupOther = bus.connect('o1', 'proj-other', 'm2', 'Bob', other.controller);

    same.enqueue.mockClear();
    other.enqueue.mockClear();

    const event: RealtimeEvent = { type: 'cursor', memberId: 'm1', memberName: 'Alice', x: 0, y: 0 };
    bus.broadcast('proj-same', event);

    expect(same.enqueue).toHaveBeenCalledTimes(1);
    expect(other.enqueue).not.toHaveBeenCalled();

    cleanupSame();
    cleanupOther();
  });

  it('handles disconnected clients by removing them (enqueue throws)', () => {
    const bus = getEventBus();
    const broken = makeController();
    const cleanupBroken = bus.connect('brk', 'proj-brk', 'm1', 'Alice', broken.controller);

    // Make enqueue throw to simulate a disconnected/closed stream
    broken.enqueue.mockImplementation(() => {
      throw new Error('stream closed');
    });

    const other = makeController();
    const cleanupOther = bus.connect('oth', 'proj-brk', 'm2', 'Bob', other.controller);
    other.enqueue.mockClear();

    const event: RealtimeEvent = { type: 'cursor', memberId: 'm2', memberName: 'Bob', x: 1, y: 1 };
    bus.broadcast('proj-brk', event);

    // The broken client's enqueue threw, so it should have been removed.
    // The other client should still receive the event.
    expect(other.enqueue).toHaveBeenCalledTimes(1);

    // Broadcast again — broken client should no longer be in the list
    // (no second throw, and other client gets exactly one more call)
    broken.enqueue.mockClear();
    other.enqueue.mockClear();
    bus.broadcast('proj-brk', event);
    expect(broken.enqueue).not.toHaveBeenCalled(); // removed, not iterated
    expect(other.enqueue).toHaveBeenCalledTimes(1);

    cleanupBroken();
    cleanupOther();
  });

  it('does not crash when broadcasting to a project with no clients', () => {
    const bus = getEventBus();
    expect(() => {
      bus.broadcast('proj-empty', { type: 'cursor', memberId: 'x', memberName: 'X', x: 0, y: 0 });
    }).not.toThrow();
  });
});

describe('EventBus.getPresence', () => {
  it('returns only clients for the specified project', () => {
    const bus = getEventBus();
    const c1 = makeController();
    const c2 = makeController();
    const c3 = makeController();
    const cleanup1 = bus.connect('p1', 'proj-pres', 'm1', 'Alice', c1.controller);
    const cleanup2 = bus.connect('p2', 'proj-pres', 'm2', 'Bob', c2.controller);
    const cleanup3 = bus.connect('p3', 'proj-other', 'm3', 'Carol', c3.controller);

    const presence = bus.getPresence('proj-pres');
    expect(presence).toHaveLength(2);
    expect(presence.map(p => p.memberName).sort()).toEqual(['Alice', 'Bob']);

    const otherPresence = bus.getPresence('proj-other');
    expect(otherPresence).toHaveLength(1);
    expect(otherPresence[0].memberName).toBe('Carol');

    cleanup1();
    cleanup2();
    cleanup3();
  });

  it('returns empty array for a project with no connected clients', () => {
    const bus = getEventBus();
    expect(bus.getPresence('proj-nobody')).toEqual([]);
  });
});

describe('EventBus — multiple connections with same memberId', () => {
  it('treats two connections from the same memberId as separate clients', () => {
    const bus = getEventBus();
    const c1 = makeController();
    const c2 = makeController();
    const cleanup1 = bus.connect('dup1', 'proj-dup', 'same-member', 'Alice', c1.controller);
    const cleanup2 = bus.connect('dup2', 'proj-dup', 'same-member', 'Alice', c2.controller);

    // Both should be present
    const presence = bus.getPresence('proj-dup');
    expect(presence).toHaveLength(2);
    expect(presence.every(p => p.memberId === 'same-member')).toBe(true);

    c1.enqueue.mockClear();
    c2.enqueue.mockClear();

    // Broadcast to the project — both should receive it
    const event: RealtimeEvent = { type: 'cursor', memberId: 'same-member', memberName: 'Alice', x: 0, y: 0 };
    bus.broadcast('proj-dup', event);
    expect(c1.enqueue).toHaveBeenCalledTimes(1);
    expect(c2.enqueue).toHaveBeenCalledTimes(1);

    cleanup1();
    cleanup2();
  });
});