import type { AuthoringSession } from "./courseAuthoring.types";
import type { QueryClient } from "@tanstack/react-query";

export type AuthoringWorkOutcome = "completed" | "failed" | "waiting_author";
type WorkStatus = AuthoringWorkOutcome | "active" | "stopped";
type WatchedSession = {
  courseId: string;
  sessionId: string;
  sequence: number;
  requests: Map<string, WorkStatus>;
  startedAt: Map<string, number>;
};

const requestStatuses = (session: AuthoringSession) => {
  const statuses = new Map<string, WorkStatus>();
  const requestIds = new Set([
    ...(session.turns ?? []).map((turn) => turn.requestId),
    ...session.tasks.map((task) => task.requestId),
  ]);
  const sourceTaskIds = new Set(
    session.records.flatMap((record) =>
      record.kind === "source" && typeof record.payload.taskId === "string"
        ? [record.payload.taskId]
        : [],
    ),
  );
  requestIds.forEach((requestId) => {
    const turn = session.turns?.find((item) => item.requestId === requestId);
    const tasks = session.tasks.filter((task) => task.requestId === requestId);
    if (!turn && tasks.every((task) => task.kind === "source" || sourceTaskIds.has(task.taskId)))
      return;
    if (
      turn?.status === "queued" ||
      turn?.status === "running" ||
      turn?.status === "sending" ||
      tasks.some((task) => ["queued", "running"].includes(task.status))
    ) {
      statuses.set(requestId, "active");
    } else if (turn?.status === "failed" || tasks.some((task) => task.status === "failed")) {
      statuses.set(requestId, "failed");
    } else if (
      turn?.status === "waiting_author" ||
      tasks.some((task) => task.status === "waiting_author")
    ) {
      statuses.set(requestId, "waiting_author");
    } else if (tasks.some((task) => task.status === "waiting_dependencies")) {
      statuses.set(requestId, "active");
    } else if (
      turn?.status === "completed" ||
      (tasks.length > 0 &&
        tasks.some((task) => task.status === "succeeded") &&
        tasks.every((task) => ["succeeded", "superseded"].includes(task.status)))
    ) {
      statuses.set(requestId, "completed");
    } else {
      statuses.set(requestId, "stopped");
    }
  });
  return statuses;
};

/** Watches work seen running in this login. Opening old finished sessions stays quiet. */
export const observeAuthoringWork = ({
  client,
  refresh,
  notify,
  isUnavailable,
  intervalMs = 10_000,
  seedCachedSessions = true,
  longRunningMs = 10_000,
}: {
  client: QueryClient;
  refresh: (courseId: string, sessionId: string) => Promise<AuthoringSession>;
  notify: (outcome: AuthoringWorkOutcome, session: AuthoringSession) => void;
  isUnavailable: (error: unknown) => boolean;
  intervalMs?: number;
  seedCachedSessions?: boolean;
  longRunningMs?: number;
}) => {
  const watched = new Map<string, WatchedSession>();
  const inFlight = new Set<string>();
  let disposed = false;
  const accept = (session: AuthoringSession) => {
    if (disposed) return;
    const key = `${session.courseId}:${session.sessionId}`;
    const previous = watched.get(key);
    if (previous && session.snapshotSequence < previous.sequence) return;
    const requests = requestStatuses(session);
    const startedAt = previous?.startedAt ?? new Map<string, number>();
    requests.forEach((status, requestId) => {
      const before = previous?.requests.get(requestId);
      if (
        status === "active" &&
        (!before ||
          ["failed", "completed", "stopped"].includes(before) ||
          !startedAt.has(requestId))
      ) {
        startedAt.set(requestId, Date.now());
      }
      const isLongRunning = Date.now() - (startedAt.get(requestId) ?? Date.now()) >= longRunningMs;
      if (
        before &&
        (before === "active" || before === "waiting_author") &&
        status !== before &&
        status !== "active" &&
        status !== "stopped" &&
        (status !== "completed" || isLongRunning)
      ) {
        notify(status, session);
      }
    });
    watched.set(key, {
      courseId: session.courseId,
      sessionId: session.sessionId,
      sequence: session.snapshotSequence,
      requests,
      startedAt,
    });
  };
  const cache = client.getQueryCache();
  const unsubscribe = cache.subscribe((event) => {
    const key = event.query.queryKey;
    if (key[0] !== "course-authoring" || key[2] !== "session") return;
    if (event.type === "removed") {
      const watchedKey = `${key[1]}:${key[3]}`;
      // Query garbage collection must not abandon long-running background work.
      if (![...(watched.get(watchedKey)?.requests.values() ?? [])].includes("active")) {
        watched.delete(watchedKey);
      }
      return;
    }
    if (event.type !== "updated" || event.action.type !== "success") return;
    const session = event.query.state.data as AuthoringSession | undefined;
    if (session) accept(session);
  });
  if (seedCachedSessions)
    cache.findAll({ queryKey: ["course-authoring"] }).forEach((query) => {
      if (query.queryKey[2] !== "session" || !query.state.data) return;
      accept(query.state.data as AuthoringSession);
    });
  const timer = setInterval(() => {
    watched.forEach((entry, key) => {
      if (inFlight.has(key) || ![...entry.requests.values()].includes("active")) return;
      inFlight.add(key);
      void refresh(entry.courseId, entry.sessionId)
        .then(accept)
        .catch((error: unknown) => {
          if (isUnavailable(error)) watched.delete(key);
        })
        .finally(() => inFlight.delete(key));
    });
  }, intervalMs);
  return () => {
    disposed = true;
    clearInterval(timer);
    unsubscribe();
    watched.clear();
  };
};
