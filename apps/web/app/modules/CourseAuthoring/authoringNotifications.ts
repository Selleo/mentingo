import {
  AUTHORING_TASK_KIND,
  AUTHORING_TASK_STATUS,
  AUTHORING_TURN_STATUS,
  AUTHORING_WORK_STATUS,
} from "./courseAuthoring.constants";
import { projectWorkspaceRecords } from "./courseAuthoring.records";
import { PROPOSAL_DECISION } from "./review/curriculumReview.constants";

import type { AUTHORING_WORK_OUTCOME } from "./courseAuthoring.constants";
import type { AuthoringSession } from "./courseAuthoring.types";
import type { QueryClient } from "@tanstack/react-query";

export type AuthoringWorkOutcome =
  (typeof AUTHORING_WORK_OUTCOME)[keyof typeof AUTHORING_WORK_OUTCOME];
type WorkStatus = (typeof AUTHORING_WORK_STATUS)[keyof typeof AUTHORING_WORK_STATUS];
type WatchedSession = {
  courseId: string;
  sessionId: string;
  sequence: number;
  requests: Map<string, WorkStatus>;
  startedAt: Map<string, number>;
};

const requestStatuses = (session: AuthoringSession) => {
  const projection = projectWorkspaceRecords(session.records, session.tasks);
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
    const taskIds = new Set(tasks.map((task) => task.taskId));
    const artifactIds = new Set(
      turn?.parts.flatMap((part) => part.artifact?.artifactId ?? []) ?? [],
    );
    const proposals = projection.proposals.filter(
      (proposal) =>
        (artifactIds.has(proposal.id) || (proposal.taskId && taskIds.has(proposal.taskId))) &&
        !tasks.some(
          (task) =>
            task.taskId === proposal.taskId &&
            [AUTHORING_TASK_STATUS.SUPERSEDED, AUTHORING_TASK_STATUS.STOPPED].some(
              (value) => value === task.status,
            ),
        ),
    );
    const needsAnswer =
      projection.questions.some(
        (question) =>
          !question.answered &&
          (question.requestId === requestId ||
            taskIds.has(question.taskId) ||
            artifactIds.has(question.id)),
      ) ||
      tasks.some(
        (task) =>
          task.status === AUTHORING_TASK_STATUS.WAITING_AUTHOR &&
          !proposals.some(
            (proposal) =>
              proposal.taskId === task.taskId &&
              proposal.id === task.outputId &&
              [PROPOSAL_DECISION.PENDING, PROPOSAL_DECISION.ACCEPTED].some(
                (value) => value === proposal.decision,
              ),
          ),
      );
    if (
      !turn &&
      tasks.every(
        (task) => task.kind === AUTHORING_TASK_KIND.SOURCE || sourceTaskIds.has(task.taskId),
      )
    )
      return;
    if (
      turn?.status === AUTHORING_TURN_STATUS.QUEUED ||
      turn?.status === AUTHORING_TURN_STATUS.RUNNING ||
      turn?.status === AUTHORING_TURN_STATUS.SENDING ||
      tasks.some((task) =>
        [AUTHORING_TASK_STATUS.QUEUED, AUTHORING_TASK_STATUS.RUNNING].some(
          (value) => value === task.status,
        ),
      )
    ) {
      statuses.set(requestId, AUTHORING_WORK_STATUS.ACTIVE);
    } else if (needsAnswer) {
      statuses.set(requestId, AUTHORING_WORK_STATUS.WAITING_AUTHOR);
    } else if (
      turn?.status === AUTHORING_TURN_STATUS.FAILED ||
      tasks.some((task) => task.status === AUTHORING_TASK_STATUS.FAILED)
    ) {
      statuses.set(requestId, AUTHORING_WORK_STATUS.FAILED);
    } else if (tasks.some((task) => task.status === AUTHORING_TASK_STATUS.WAITING_DEPENDENCIES)) {
      statuses.set(requestId, AUTHORING_WORK_STATUS.ACTIVE);
    } else if (
      proposals.some(
        (proposal) => proposal.decision === PROPOSAL_DECISION.PENDING && proposal.outline?.length,
      )
    ) {
      statuses.set(requestId, AUTHORING_WORK_STATUS.OUTLINE_READY);
    } else if (
      proposals.some(
        (proposal) =>
          [PROPOSAL_DECISION.PENDING, PROPOSAL_DECISION.ACCEPTED].some(
            (value) => value === proposal.decision,
          ) && proposal.operations.length > 0,
      )
    ) {
      statuses.set(requestId, AUTHORING_WORK_STATUS.CHANGES_READY);
    } else if (
      turn?.status === AUTHORING_TURN_STATUS.WAITING_AUTHOR ||
      tasks.some((task) => task.status === AUTHORING_TASK_STATUS.WAITING_AUTHOR)
    ) {
      statuses.set(requestId, AUTHORING_WORK_STATUS.WAITING_AUTHOR);
    } else if (
      turn?.status === AUTHORING_TURN_STATUS.COMPLETED ||
      (tasks.length > 0 &&
        tasks.some((task) => task.status === AUTHORING_TASK_STATUS.SUCCEEDED) &&
        tasks.every((task) =>
          [AUTHORING_TASK_STATUS.SUCCEEDED, AUTHORING_TASK_STATUS.SUPERSEDED].some(
            (value) => value === task.status,
          ),
        ))
    ) {
      statuses.set(requestId, AUTHORING_WORK_STATUS.COMPLETED);
    } else {
      statuses.set(requestId, AUTHORING_WORK_STATUS.STOPPED);
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
        status === AUTHORING_WORK_STATUS.ACTIVE &&
        (!before ||
          [
            AUTHORING_WORK_STATUS.FAILED,
            AUTHORING_WORK_STATUS.COMPLETED,
            AUTHORING_WORK_STATUS.OUTLINE_READY,
            AUTHORING_WORK_STATUS.CHANGES_READY,
            AUTHORING_WORK_STATUS.STOPPED,
          ].some((value) => value === before) ||
          !startedAt.has(requestId))
      ) {
        startedAt.set(requestId, Date.now());
      }
      const isLongRunning = Date.now() - (startedAt.get(requestId) ?? Date.now()) >= longRunningMs;
      if (
        before &&
        (before === AUTHORING_WORK_STATUS.ACTIVE ||
          before === AUTHORING_WORK_STATUS.WAITING_AUTHOR ||
          (startedAt.has(requestId) &&
            [
              AUTHORING_WORK_STATUS.WAITING_AUTHOR,
              AUTHORING_WORK_STATUS.OUTLINE_READY,
              AUTHORING_WORK_STATUS.CHANGES_READY,
            ].some((value) => value === status))) &&
        status !== before &&
        status !== AUTHORING_WORK_STATUS.ACTIVE &&
        status !== AUTHORING_WORK_STATUS.STOPPED &&
        (status !== AUTHORING_WORK_STATUS.COMPLETED || isLongRunning)
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
      if (
        ![...(watched.get(watchedKey)?.requests.values() ?? [])].includes(
          AUTHORING_WORK_STATUS.ACTIVE,
        )
      ) {
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
      if (inFlight.has(key) || ![...entry.requests.values()].includes(AUTHORING_WORK_STATUS.ACTIVE))
        return;
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
