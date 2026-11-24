import { openIndependentSocket } from "~/api/socket";

import { applyAuthoringEvent, decideEventCursor } from "./courseAuthoring.events";

import type { AuthoringEvent, AuthoringSession } from "./courseAuthoring.types";

const JOIN_TIMEOUT_MS = 10_000;

type Publish = (session: AuthoringSession) => void;
type BackgroundSubscription = {
  session: AuthoringSession;
  listeners: Set<Publish>;
  joining?: { snapshotRequired: boolean };
};

/** Watch hidden sessions through one lazy socket, independent of the open editor's rooms. */
export const createAuthoringNotificationStream = () => {
  const subscriptions = new Map<string, BackgroundSubscription>();
  let connection: ReturnType<typeof openIndependentSocket> | undefined;

  const release = () => {
    if (subscriptions.size) return;
    const previous = connection;
    connection = undefined;
    previous?.dispose();
  };

  const join = (entry: BackgroundSubscription, snapshotRequired = false, canRetry = true) => {
    const socket = connection?.socket;
    if (
      !socket?.connected ||
      (entry.joining && (!snapshotRequired || entry.joining.snapshotRequired))
    )
      return;

    const { courseId, sessionId, snapshotSequence } = entry.session;
    const attempt = { snapshotRequired };
    entry.joining = attempt;
    socket
      .timeout(JOIN_TIMEOUT_MS)
      .emit(
        "join:course-authoring",
        { courseId, sessionId, afterSequence: snapshotSequence, hasSnapshot: !snapshotRequired },
      (error: Error | null, reply?: { code?: string }) => {
          if (subscriptions.get(sessionId) !== entry || entry.joining !== attempt) return;
          entry.joining = undefined;
        if (canRetry && (error || reply?.code === "join_failed")) join(entry, true, false);
        },
      );
  };

  const publish = (entry: BackgroundSubscription, snapshot: AuthoringSession) => {
    if (snapshot.snapshotSequence < entry.session.snapshotSequence) return;
    entry.session = snapshot;
    entry.listeners.forEach((listener) => listener(snapshot));
  };

  const connect = () => {
    if (connection) return;
    const opened = openIndependentSocket();
    connection = opened;
    const { socket } = opened;
    socket.on("connect", () => {
      if (connection !== opened) return;
      subscriptions.forEach((entry) => join(entry));
    });
    socket.on("disconnect", () => {
      if (connection !== opened) return;
      subscriptions.forEach((entry) => {
        entry.joining = undefined;
      });
    });
    socket.on("authoring.snapshot", (snapshot: AuthoringSession) => {
      if (connection !== opened) return;
      const entry = subscriptions.get(snapshot.sessionId);
      if (entry) publish(entry, snapshot);
    });
    socket.on("authoring.event", (event: AuthoringEvent) => {
      if (connection !== opened) return;
      const entry = subscriptions.get(event.sessionId);
      if (!entry) return;
      const decision = decideEventCursor(entry.session, event);
      if (decision.type === "apply") publish(entry, applyAuthoringEvent(entry.session, event));
      if (decision.type === "gap") join(entry, true);
    });
    socket.on("authoring.error", (error: { sessionId?: string; code?: string }) => {
      if (connection !== opened) return;
      if (
        error.sessionId &&
        (error.code === "permission_revoked" || error.code === "session_not_found")
      ) {
        subscriptions.delete(error.sessionId);
        release();
      }
    });
    socket.connect();
  };

  return (session: AuthoringSession, listener: Publish) => {
    const { sessionId } = session;
    const existing = subscriptions.get(sessionId);
    const entry = existing ?? { session, listeners: new Set<Publish>() };
    entry.listeners.add(listener);
    if (!existing) {
      subscriptions.set(sessionId, entry);
      connect();
      join(entry);
    }

    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size || subscriptions.get(sessionId) !== entry) return;
      subscriptions.delete(sessionId);
      if (connection?.socket.connected) {
        connection.socket.emit("leave:course-authoring", { sessionId });
      }
      release();
    };
  };
};
