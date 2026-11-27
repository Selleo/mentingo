import { openIndependentSocket } from "~/api/socket";

import { AUTHORING_STREAM_LOSS } from "./courseAuthoring.constants";
import { applyAuthoringEvent, decideEventCursor } from "./courseAuthoring.events";

import type {
  AuthoringEvent,
  AuthoringSession,
  AuthoringStreamLoss,
} from "./courseAuthoring.types";

const JOIN_TIMEOUT_MS = 10_000;
export const MAX_JOIN_ATTEMPTS = 5;
const JOIN_RETRY_BASE_MS = 1_000;
const JOIN_RETRY_MAX_MS = 15_000;

type Publish = (session: AuthoringSession) => void;
type Lose = (reason: AuthoringStreamLoss) => void;
type BackgroundSubscription = {
  session: AuthoringSession;
  listeners: Set<Publish>;
  lossListeners: Set<Lose>;
  joining?: { snapshotRequired: boolean };
  failedJoins: number;
  retryTimer?: ReturnType<typeof setTimeout>;
};

export const joinRetryDelay = (failedJoins: number) =>
  Math.min(JOIN_RETRY_BASE_MS * 2 ** (failedJoins - 1), JOIN_RETRY_MAX_MS);

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

  const cancelRetry = (entry: BackgroundSubscription) => {
    if (entry.retryTimer) clearTimeout(entry.retryTimer);
    entry.retryTimer = undefined;
  };

  const drop = (entry: BackgroundSubscription, reason: AuthoringStreamLoss) => {
    const { sessionId } = entry.session;
    if (subscriptions.get(sessionId) !== entry) return;
    cancelRetry(entry);
    subscriptions.delete(sessionId);
    if (reason === AUTHORING_STREAM_LOSS.UNAVAILABLE && connection?.socket.connected) {
      connection.socket.emit("leave:course-authoring", { sessionId });
    }
    release();
    entry.lossListeners.forEach((listener) => listener(reason));
  };

  const join = (entry: BackgroundSubscription, snapshotRequired = false) => {
    const socket = connection?.socket;
    if (
      !socket?.connected ||
      (entry.joining && (!snapshotRequired || entry.joining.snapshotRequired))
    )
      return;

    cancelRetry(entry);
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
          if (!error && reply?.code !== "join_failed") {
            entry.failedJoins = 0;
            return;
          }
          entry.failedJoins += 1;
          if (entry.failedJoins >= MAX_JOIN_ATTEMPTS) {
            drop(entry, AUTHORING_STREAM_LOSS.UNAVAILABLE);
            return;
          }
          entry.retryTimer = setTimeout(() => {
            entry.retryTimer = undefined;
            if (subscriptions.get(sessionId) === entry) join(entry, true);
          }, joinRetryDelay(entry.failedJoins));
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
        entry.failedJoins = 0;
        cancelRetry(entry);
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
      if (connection !== opened || !error.sessionId) return;
      const entry = subscriptions.get(error.sessionId);
      if (entry && (error.code === "permission_revoked" || error.code === "session_not_found")) {
        drop(entry, AUTHORING_STREAM_LOSS.REVOKED);
      }
    });
    socket.connect();
  };

  return (session: AuthoringSession, listener: Publish, onLoss?: Lose) => {
    const { sessionId } = session;
    const existing = subscriptions.get(sessionId);
    const entry: BackgroundSubscription = existing ?? {
      session,
      listeners: new Set<Publish>(),
      lossListeners: new Set<Lose>(),
      failedJoins: 0,
    };
    entry.listeners.add(listener);
    if (onLoss) entry.lossListeners.add(onLoss);
    if (!existing) {
      subscriptions.set(sessionId, entry);
      connect();
      join(entry);
    }

    return () => {
      entry.listeners.delete(listener);
      if (onLoss) entry.lossListeners.delete(onLoss);
      if (entry.listeners.size || subscriptions.get(sessionId) !== entry) return;
      cancelRetry(entry);
      subscriptions.delete(sessionId);
      if (connection?.socket.connected) {
        connection.socket.emit("leave:course-authoring", { sessionId });
      }
      release();
    };
  };
};
