import { broadcastBoardUpdate } from '../realtime/broadcast';
import { getEventBus } from '../realtime/EventBus';

describe('broadcastBoardUpdate', () => {
  it('calls bus.broadcast with a board-update event for the given projectId', () => {
    const bus = getEventBus();
    const spy = jest.spyOn(bus, 'broadcast');

    broadcastBoardUpdate('proj-1', 'task-created');

    expect(spy).toHaveBeenCalledWith('proj-1', {
      type: 'board-update',
      boardId: 'proj-1',
      change: 'task-created',
    });

    spy.mockRestore();
  });

  it('is a no-op when projectId is undefined', () => {
    const bus = getEventBus();
    const spy = jest.spyOn(bus, 'broadcast');

    broadcastBoardUpdate(undefined, 'task-created');

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it('is a no-op when projectId is null', () => {
    const bus = getEventBus();
    const spy = jest.spyOn(bus, 'broadcast');

    broadcastBoardUpdate(null, 'task-created');

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});