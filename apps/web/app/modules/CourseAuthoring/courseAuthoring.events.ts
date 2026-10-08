/** Applies durable sequence rules to websocket events and requests snapshot recovery on gaps. */
import { parseAuthoringTaskFailure } from "./authoringTaskFailure";

import type {
  AuthoringEvent,
  AuthoringPartKind,
  AuthoringRecord,
  AuthoringSession,
  AuthoringTask,
  AuthoringTurn,
  AuthoringTurnPart,
  AuthoringTurnPartStatus,
  AuthoringTurnStatus,
} from "./courseAuthoring.types";

export type EventCursorDecision =
  | { type: "ignore"; cursor: number }
  | { type: "apply"; cursor: number }
  | { type: "gap"; cursor: number };

/** Classifies an event as duplicate, contiguous, or requiring snapshot recovery. */
export const decideEventCursor = (
  session: AuthoringSession,
  event: AuthoringEvent,
): EventCursorDecision => {
  if (event.schemaVersion !== 1 || event.sessionId !== session.sessionId) {
    return { type: "ignore", cursor: session.snapshotSequence };
  }
  if (!Number.isSafeInteger(event.sequence) || event.sequence <= session.snapshotSequence) {
    return { type: "ignore", cursor: session.snapshotSequence };
  }
  if (event.sequence !== session.snapshotSequence + 1) {
    return { type: "gap", cursor: session.snapshotSequence };
  }
  return { type: "apply", cursor: event.sequence };
};

/** Advances a session cursor only after its event sequence is accepted. */
export const advanceSessionCursor = (
  session: AuthoringSession,
  event: AuthoringEvent,
): AuthoringSession => ({
  ...session,
  snapshotSequence: event.sequence,
  workspaceRevision:
    typeof event.payload.workspaceRevision === "number"
      ? event.payload.workspaceRevision
      : session.workspaceRevision,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const integerValue = (value: unknown, minimum: number): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? value : null;

const isTurnStatus = (value: unknown): value is AuthoringTurnStatus =>
  value === "sending" ||
  value === "queued" ||
  value === "running" ||
  value === "waiting_author" ||
  value === "completed" ||
  value === "failed" ||
  value === "stopped";

const isPartKind = (value: unknown): value is AuthoringPartKind =>
  value === "text" || value === "tool" || value === "proposal" || value === "question";

const isPartStatus = (value: unknown): value is AuthoringTurnPartStatus =>
  value === "streaming" ||
  value === "completed" ||
  value === "failed" ||
  value === "started" ||
  value === "stopped" ||
  value === "review";

const nullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : null;
};

const objectOrNull = (value: unknown): Record<string, unknown> | null => {
  if (value === null || value === undefined) return null;
  return isObject(value) ? value : null;
};

const isToolStatus = (value: unknown): value is NonNullable<AuthoringTurnPart["tool"]>["status"] =>
  value === "started" || value === "completed" || value === "failed" || value === "stopped";

const parseTurnPart = (
  rawPart: Record<string, unknown>,
  eventSequence: number,
  requestId: string,
  messageId: string,
): AuthoringTurnPart | null => {
  const partId = stringValue(rawPart.partId);
  const partRequestId = stringValue(rawPart.requestId);
  const partMessageId = stringValue(rawPart.messageId);
  const partKind = rawPart.partKind;
  const status = rawPart.status;
  const firstSequence = integerValue(rawPart.firstSequence, 1);
  const updatedSequence = integerValue(rawPart.updatedSequence, 1);
  const taskId =
    rawPart.taskId === null || rawPart.taskId === undefined ? null : stringValue(rawPart.taskId);
  if (
    !partId ||
    partRequestId !== requestId ||
    partMessageId !== messageId ||
    !isPartKind(partKind) ||
    !isPartStatus(status) ||
    firstSequence === null ||
    updatedSequence === null ||
    updatedSequence !== eventSequence ||
    (rawPart.taskId !== null && rawPart.taskId !== undefined && !taskId)
  ) {
    return null;
  }

  const text = nullableString(rawPart.text);
  if (rawPart.text !== null && rawPart.text !== undefined && text === null) return null;
  const answer = nullableString(rawPart.answer);
  if (rawPart.answer !== null && rawPart.answer !== undefined && answer === null) return null;
  const planSteps = Array.isArray(rawPart.planSteps)
    ? rawPart.planSteps.filter((step): step is string => typeof step === "string").slice(0, 6)
    : undefined;

  const rawTool = objectOrNull(rawPart.tool);
  const rawArtifact = objectOrNull(rawPart.artifact);
  if (
    (rawPart.tool !== null && rawPart.tool !== undefined && !rawTool) ||
    (rawPart.artifact !== null && rawPart.artifact !== undefined && !rawArtifact)
  ) {
    return null;
  }

  let tool: AuthoringTurnPart["tool"] = null;
  if (rawTool) {
    const toolCallId = stringValue(rawTool.toolCallId);
    const toolName = stringValue(rawTool.toolName);
    const display = nullableString(rawTool.display);
    const toolStatus = rawTool.status;
    if (!toolCallId || !toolName || display === null || !isToolStatus(toolStatus)) {
      return null;
    }
    tool = {
      toolCallId,
      toolName,
      display,
      status: toolStatus,
      result: parseToolResult(rawTool.result),
    };
  }

  let artifact: AuthoringTurnPart["artifact"] = null;
  if (rawArtifact) {
    const artifactKind = rawArtifact.artifactKind;
    const artifactId = stringValue(rawArtifact.artifactId);
    if ((artifactKind !== "proposal" && artifactKind !== "question") || !artifactId) return null;
    artifact = { artifactKind, artifactId };
  }

  return {
    requestId,
    messageId,
    partId,
    partKind,
    taskId,
    status,
    firstSequence,
    updatedSequence,
    text,
    ...(planSteps ? { planSteps } : {}),
    ...(answer !== null ? { answer } : {}),
    phase: nullableString(rawPart.phase),
    tool,
    artifact,
  };
};

const parseToolResult = (value: unknown): NonNullable<AuthoringTurnPart["tool"]>["result"] => {
  const result = objectOrNull(value);
  if (!result) return null;
  return {
    ...(typeof result.query === "string" || result.query === null ? { query: result.query } : {}),
    ...(Array.isArray(result.queries) || result.queries === null
      ? {
          queries: Array.isArray(result.queries)
            ? result.queries.filter((query): query is string => typeof query === "string")
            : null,
        }
      : {}),
    sourceCount: typeof result.sourceCount === "number" ? result.sourceCount : null,
    findingCount: typeof result.findingCount === "number" ? result.findingCount : null,
  };
};

type CanonicalTurnUpdate = {
  turn: Pick<
    AuthoringTurn,
    "requestId" | "messageId" | "status" | "taskIds" | "firstSequence" | "updatedSequence"
  >;
  part: AuthoringTurnPart | null;
};

const parseCanonicalTurn = (event: AuthoringEvent): CanonicalTurnUpdate | null => {
  const eventSequence = integerValue(event.sequence, 1);
  if (eventSequence === null) return null;
  const payload = isObject(event.payload) ? event.payload : {};
  const rawTurn = isObject(payload.turn) ? payload.turn : null;
  const requestId = stringValue(rawTurn?.requestId);
  const messageId = stringValue(rawTurn?.messageId);
  const firstSequence = integerValue(rawTurn?.firstSequence, 1);
  const updatedSequence = integerValue(rawTurn?.updatedSequence, 1);
  const taskIds = rawTurn?.taskIds;
  if (
    !rawTurn ||
    !requestId ||
    !messageId ||
    !isTurnStatus(rawTurn.status) ||
    firstSequence === null ||
    updatedSequence === null ||
    updatedSequence !== eventSequence ||
    !Array.isArray(taskIds) ||
    taskIds.some((taskId) => !stringValue(taskId))
  ) {
    return null;
  }

  const rawPart = objectOrNull(rawTurn.part);
  if (rawTurn.part !== null && rawTurn.part !== undefined && !rawPart) return null;
  return {
    turn: {
      requestId,
      messageId,
      status: rawTurn.status,
      taskIds: taskIds.map((taskId) => stringValue(taskId) as string),
      firstSequence,
      updatedSequence,
    },
    part: rawPart ? parseTurnPart(rawPart, eventSequence, requestId, messageId) : null,
  };
};

const mergeTurn = (session: AuthoringSession, update: CanonicalTurnUpdate): AuthoringTurn[] => {
  const turns = session.turns ? [...session.turns] : [];
  const index = turns.findIndex((turn) => turn.requestId === update.turn.requestId);
  const existing = index >= 0 ? turns[index] : undefined;
  if (existing && existing.updatedSequence > update.turn.updatedSequence) return turns;

  const parts = existing ? [...existing.parts] : [];
  if (update.part) {
    const partIndex = parts.findIndex((part) => part.partId === update.part?.partId);
    if (partIndex < 0) parts.push(update.part);
    else parts[partIndex] = { ...parts[partIndex], ...update.part };
  }
  parts.sort(
    (left, right) =>
      left.firstSequence - right.firstSequence || left.partId.localeCompare(right.partId),
  );
  const nextTurn: AuthoringTurn = { ...existing, ...update.turn, parts };
  if (index < 0) turns.push(nextTurn);
  else turns[index] = nextTurn;
  return turns.sort(
    (left, right) =>
      left.firstSequence - right.firstSequence || left.requestId.localeCompare(right.requestId),
  );
};

/** Reads one bounded record projection carried by a durable event. */
const parseEventRecord = (payload: Record<string, unknown>): AuthoringRecord | null => {
  const record = objectOrNull(payload.record);
  const id = stringValue(record?.id);
  const kind = stringValue(record?.kind);
  const recordPayload = objectOrNull(record?.payload);
  if (!id || !kind || !recordPayload) return null;
  return { id, kind, payload: recordPayload };
};

/** Merges one immutable record projection without changing its durable order. */
const mergeEventRecord = (
  records: AuthoringRecord[],
  record: AuthoringRecord | null,
): AuthoringRecord[] => {
  if (!record) return records;
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index < 0) return [...records, record];
  const next = [...records];
  next[index] = record;
  return next;
};

/** Applies display-safe assistant and task updates without waiting for a snapshot round trip. */
export const applyAuthoringEvent = (
  session: AuthoringSession,
  event: AuthoringEvent,
): AuthoringSession => {
  const next = advanceSessionCursor(session, event);
  const canonicalTurn = parseCanonicalTurn(event);
  const withTurn = canonicalTurn ? { ...next, turns: mergeTurn(next, canonicalTurn) } : next;
  const payload = isObject(event.payload) ? event.payload : {};
  const questionAnswerRecord = (() => {
    if (event.type !== "question.answered") return null;
    const taskId = stringValue(payload.taskId);
    const requestId = stringValue(payload.requestId);
    const revision = integerValue(payload.revision, 0);
    const answer = stringValue(payload.answer);
    const id = stringValue(payload.recordId);
    if (!taskId || !requestId || revision === null || !answer || !id) return null;
    return {
      id,
      kind: "question_answer",
      payload: { taskId, requestId, revision, answer },
    };
  })();
  const proposalStatusRecord = (() => {
    if (event.type !== "proposal.status") return null;
    const proposalId = stringValue(payload.proposalId);
    const status = stringValue(payload.status);
    if (
      !proposalId ||
      !status ||
      !["accepted", "rejected", "applied", "superseded", "discarded"].includes(status)
    ) {
      return null;
    }
    return {
      id: event.eventId,
      kind: "decision",
      payload: {
        proposalId,
        sequence: event.sequence,
        accepted: status === "accepted" || status === "applied",
        status,
      },
    };
  })();
  const withRecord = {
    ...withTurn,
    records: mergeEventRecord(
      withTurn.records,
      parseEventRecord(payload) ??
        questionAnswerRecord ??
        proposalStatusRecord ??
        (isObject(payload.workProgress) &&
        stringValue(payload.taskId) &&
        stringValue(payload.requestId)
          ? {
              id: event.eventId,
              kind: event.type,
              payload: { ...payload, sequence: event.sequence },
            }
          : null),
    ),
  };
  let eventRecord: Record<string, unknown> = payload;
  if (event.type === "task.updated" && isObject(payload.task)) eventRecord = payload.task;
  else if (isObject(payload.record)) eventRecord = payload.record;
  const recordPayload = isObject(eventRecord.payload) ? eventRecord.payload : eventRecord;
  const taskId = stringValue(recordPayload.taskId);
  const phase = stringValue(recordPayload.phase);
  const errorCode = stringValue(recordPayload.errorCode);
  const outputId = stringValue(recordPayload.outputId);

  const taskStatusByEvent: Record<string, AuthoringTask["status"]> = {
    "task.queued": "queued",
    "task.running": "running",
    "task.waiting_author": "waiting_author",
    "task.waiting_dependencies": "waiting_dependencies",
    "task.succeeded": "succeeded",
    "task.failed": "failed",
    "task.superseded": "superseded",
    "task.stopped": "stopped",
  };
  const taskStatus = taskStatusByEvent[event.type];
  const isTaskUpdate = event.type === "task.updated";
  if (taskId && (taskStatus || isTaskUpdate)) {
    const taskSnapshot =
      event.type === "task.updated" && isObject(payload.task) ? payload.task : recordPayload;
    const updatedTaskId = stringValue(taskSnapshot.taskId) ?? taskId;
    const requestId = stringValue(taskSnapshot.requestId);
    const rawStatus = taskSnapshot.status;
    const supportedTaskStatuses: AuthoringTask["status"][] = [
      "queued",
      "running",
      "waiting_author",
      "waiting_dependencies",
      "paused",
      "succeeded",
      "failed",
      "superseded",
      "stopped",
    ];
    let taskStatusValue = taskStatus ?? null;
    if (isTaskUpdate && supportedTaskStatuses.includes(rawStatus as AuthoringTask["status"])) {
      taskStatusValue = rawStatus as AuthoringTask["status"];
    }
    if (!taskStatusValue) return withRecord;

    const existingTask = withRecord.tasks.find((task) => task.taskId === updatedTaskId);
    const kind =
      typeof taskSnapshot.kind === "string" || taskSnapshot.kind === null
        ? taskSnapshot.kind
        : existingTask?.kind;
    const updatedTask: AuthoringTask = {
      taskId: updatedTaskId,
      requestId: requestId ?? existingTask?.requestId ?? "",
      ...(kind !== undefined ? { kind } : {}),
      status: taskStatusValue,
      phase: stringValue(taskSnapshot.phase) ?? phase ?? existingTask?.phase ?? null,
      errorCode:
        taskStatusValue === "failed"
          ? (stringValue(taskSnapshot.errorCode) ?? errorCode ?? existingTask?.errorCode ?? null)
          : null,
      failure:
        taskStatusValue === "failed" || taskStatusValue === "waiting_author"
          ? (parseAuthoringTaskFailure(taskSnapshot.failure) ?? existingTask?.failure ?? null)
          : null,
      outputId: stringValue(taskSnapshot.outputId) ?? outputId ?? existingTask?.outputId ?? null,
    };
    if (!updatedTask.requestId) return withRecord;

    return {
      ...withRecord,
      tasks: existingTask
        ? withRecord.tasks.map((task) => (task.taskId === updatedTaskId ? updatedTask : task))
        : [...withRecord.tasks, updatedTask],
    };
  }

  return withRecord;
};
