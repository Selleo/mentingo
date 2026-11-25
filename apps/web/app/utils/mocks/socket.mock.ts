type SocketHandler = (payload?: unknown) => void;

const handlersByEvent = new Map<string, Set<SocketHandler>>();

/** Stands in for the shared socket so tests can deliver server events without a connection. */
export const fakeSocket = {
  connected: true,
  emitted: [] as [event: string, payload: unknown][],
  on(event: string, handler: SocketHandler) {
    handlersByEvent.set(event, (handlersByEvent.get(event) ?? new Set()).add(handler));
  },
  off(event: string, handler: SocketHandler) {
    handlersByEvent.get(event)?.delete(handler);
  },
  emit(event: string, payload?: unknown) {
    fakeSocket.emitted.push([event, payload]);
  },
  connect() {},
  disconnect() {
    return fakeSocket;
  },
  receive(event: string, payload?: unknown) {
    handlersByEvent.get(event)?.forEach((handler) => handler(payload));
  },
  reset() {
    handlersByEvent.clear();
    fakeSocket.emitted = [];
  },
};
