import { authoringSessionKey } from "~/api/queries/useCourseAuthoringSessionQuery";

import {
  authoringSessionVisibility,
  authoringSessionVisibilityKey,
} from "./authoringSessionVisibility";
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
  session: AuthoringSession;
  cacheCourseId: string;
  requests: Map<string, WorkStatus>;
  startedAt: Map<string, number>;
  stopWatching?: () => void;
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
        (task) =>
          [AUTHORING_TASK_KIND.SOURCE, AUTHORING_TASK_KIND.SOURCE_VISION].some(
            (kind) => kind === task.kind,
          ) || sourceTaskIds.has(task.taskId),
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
  watch,
  notify,
  seedCachedSessions = true,
  longRunningMs = 10_000,
}: {
  client: QueryClient;
  watch: (session: AuthoringSession, publish: (next: AuthoringSession) => void) => () => void;
  notify: (outcome: AuthoringWorkOutcome, session: AuthoringSession) => void;
  seedCachedSessions?: boolean;
  longRunningMs?: number;
}) => {
  const watched = new Map<string, WatchedSession>();
  let disposed = false;

  const hasActiveWork = (entry: WatchedSession | undefined) =>
    entry && [...entry.requests.values()].includes(AUTHORING_WORK_STATUS.ACTIVE);

  /** Hand off hidden active sessions to the background stream until a workspace resumes. */
  const reconcileWatch = (entry: WatchedSession) => {
    const { session, cacheCourseId } = entry;
    const visible = authoringSessionVisibility.getState();
    const isVisible =
      visible[authoringSessionVisibilityKey(cacheCourseId, session.sessionId)] ||
      visible[authoringSessionVisibilityKey(session.courseId, session.sessionId)];
    if (isVisible || !hasActiveWork(entry)) {
      entry.stopWatching?.();
      entry.stopWatching = undefined;
      return;
    }
    if (entry.stopWatching) return;

    const key = authoringSessionVisibilityKey(cacheCourseId, session.sessionId);
    entry.stopWatching = watch(session, (snapshot) => {
      if (
        disposed ||
        snapshot.sessionId !== session.sessionId ||
        snapshot.snapshotSequence < (watched.get(key)?.session.snapshotSequence ?? 0)
      )
        return;
      client.setQueryData<AuthoringSession>(
        authoringSessionKey(cacheCourseId, session.sessionId),
        (current) =>
          !current || snapshot.snapshotSequence >= current.snapshotSequence ? snapshot : current,
      );
    });
  };

  const accept = (session: AuthoringSession, cacheCourseId: string) => {
    if (disposed) return;
    const key = authoringSessionVisibilityKey(cacheCourseId, session.sessionId);
    const previous = watched.get(key);
    if (previous && session.snapshotSequence < previous.session.snapshotSequence) return;
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
    const entry = {
      session,
      cacheCourseId,
      requests,
      startedAt,
      stopWatching: previous?.stopWatching,
    };
    watched.set(key, entry);
    reconcileWatch(entry);
  };
  const cache = client.getQueryCache();
  const unsubscribe = cache.subscribe((event) => {
    const key = event.query.queryKey;
    if (
      key[0] !== "course-authoring" ||
      typeof key[1] !== "string" ||
      key[2] !== "session" ||
      typeof key[3] !== "string"
    )
      return;
    if (event.type === "removed") {
      const watchedKey = authoringSessionVisibilityKey(key[1], key[3]);
      // Query garbage collection must not abandon long-running background work.
      if (!hasActiveWork(watched.get(watchedKey))) {
        watched.get(watchedKey)?.stopWatching?.();
        watched.delete(watchedKey);
      }
      return;
    }
    if (event.type !== "updated" || event.action.type !== "success") return;
    const session = event.query.state.data as AuthoringSession | undefined;
    if (session) accept(session, key[1]);
  });
  if (seedCachedSessions)
    cache.findAll({ queryKey: ["course-authoring"] }).forEach((query) => {
      const key = query.queryKey;
      if (typeof key[1] !== "string" || key[2] !== "session" || !query.state.data) return;
      accept(query.state.data as AuthoringSession, key[1]);
    });
  const unsubscribeVisibility = authoringSessionVisibility.subscribe(() => {
    watched.forEach(reconcileWatch);
  });
  return () => {
    disposed = true;
    unsubscribe();
    unsubscribeVisibility();
    watched.forEach((entry) => entry.stopWatching?.());
    watched.clear();
  };
};
