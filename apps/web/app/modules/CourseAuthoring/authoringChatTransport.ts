import { parseFetchedResearchSources } from "./authoringSources";
import {
  AUTHORING_ARTIFACT_KIND,
  AUTHORING_PART_KIND,
  AUTHORING_PART_STATUS,
  AUTHORING_TOOL_STATUS,
  AUTHORING_TURN_STATUS,
} from "./courseAuthoring.constants";

import type {
  AuthoringCommand,
  AuthoringEvent,
  AuthoringPartKind,
  AuthoringRequest,
  AuthoringSession,
  AuthoringTurn,
  AuthoringTurnPart,
  AuthoringTurnPartStatus,
  AuthoringTurnStatus,
} from "./courseAuthoring.types";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export type AuthoringChatDataTypes = {
  authoringPart: {
    requestId: string;
    messageId: string;
    taskId: string | null;
    partId: string;
    partKind: AuthoringPartKind;
    status: AuthoringTurnPartStatus;
    firstSequence: number;
    updatedSequence: number;
    text: string | null;
    planSteps?: string[];
    answer?: string | null;
    phase?: string | null;
    tool: AuthoringTurnPart["tool"];
    artifact: AuthoringTurnPart["artifact"];
  };
  authoringTool: {
    requestId: string;
    taskId: string | null;
    partId: string;
    toolCallId: string;
    toolName: string;
    display: string;
    status: NonNullable<AuthoringTurnPart["tool"]>["status"];
    result: NonNullable<AuthoringTurnPart["tool"]>["result"];
  };
  authoringProposal: {
    requestId: string;
    taskId: string | null;
    partId: string;
    proposalId: string;
    revision: number | null;
  };
};

export type AuthoringChatMetadata = {
  commandId?: string;
  requestId?: string;
  sourceVersionIds?: string[];
  firstSequence?: number;
  turnStatus?: AuthoringTurnStatus;
  updatedSequence?: number;
};

export type AuthoringChatMessage = UIMessage<AuthoringChatMetadata, AuthoringChatDataTypes>;

type CommandInput = Omit<AuthoringCommand, "schemaVersion" | "commandId"> & {
  commandId: string;
};

type CommandReceipt = { requestId?: string | null };

type TransportOptions = {
  sendCommand: (command: CommandInput) => Promise<CommandReceipt>;
  subscribe: (listener: (event: AuthoringEvent) => void) => () => void;
  subscribeSnapshot?: (listener: () => void) => () => void;
  getSession: () => AuthoringSession | undefined;
};

type SendOptions = Parameters<ChatTransport<AuthoringChatMessage>["sendMessages"]>[0];
type ReconnectOptions = Parameters<
  NonNullable<ChatTransport<AuthoringChatMessage>["reconnectToStream"]>
>[0];

const textFromMessage = (message: AuthoringChatMessage | undefined): string => {
  if (!message) return "";

  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
};

const objectValue = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const integerValue = (value: unknown, minimum: number): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? value : null;

const isTurnStatus = (value: unknown): value is AuthoringTurnStatus =>
  value === AUTHORING_TURN_STATUS.QUEUED ||
  value === AUTHORING_TURN_STATUS.RUNNING ||
  value === AUTHORING_TURN_STATUS.WAITING_AUTHOR ||
  value === AUTHORING_TURN_STATUS.COMPLETED ||
  value === AUTHORING_TURN_STATUS.FAILED ||
  value === AUTHORING_TURN_STATUS.STOPPED;

const isPartKind = (value: unknown): value is AuthoringPartKind =>
  value === AUTHORING_PART_KIND.TEXT ||
  value === AUTHORING_PART_KIND.TOOL ||
  value === AUTHORING_PART_KIND.PROPOSAL ||
  value === AUTHORING_PART_KIND.QUESTION;

const isPartStatus = (value: unknown): value is AuthoringTurnPartStatus =>
  value === AUTHORING_PART_STATUS.STREAMING ||
  value === AUTHORING_PART_STATUS.COMPLETED ||
  value === AUTHORING_PART_STATUS.FAILED ||
  value === AUTHORING_PART_STATUS.STOPPED ||
  value === AUTHORING_PART_STATUS.REVIEW;

const isToolStatus = (value: unknown): value is NonNullable<AuthoringTurnPart["tool"]>["status"] =>
  value === AUTHORING_TOOL_STATUS.STARTED ||
  value === AUTHORING_TOOL_STATUS.COMPLETED ||
  value === AUTHORING_TOOL_STATUS.FAILED ||
  value === AUTHORING_TOOL_STATUS.STOPPED;

const toolValue = (value: unknown): AuthoringTurnPart["tool"] => {
  if (value === null || value === undefined) return null;
  const tool = objectValue(value);
  const toolCallId = stringValue(tool?.toolCallId);
  const toolName = stringValue(tool?.toolName);
  const display = typeof tool?.display === "string" ? tool.display : null;
  const status = tool?.status;
  if (!tool || !toolCallId || !toolName || display === null || !isToolStatus(status)) return null;

  const result =
    tool.result === null || tool.result === undefined ? null : objectValue(tool.result);
  return {
    toolCallId,
    toolName,
    display,
    status,
    result: result
      ? {
          ...(typeof result.query === "string" || result.query === null
            ? { query: result.query }
            : {}),
          ...(Array.isArray(result.queries)
            ? {
                queries: result.queries.filter(
                  (query): query is string => typeof query === "string",
                ),
              }
            : {}),
          ...(Array.isArray(result.sources)
            ? { sources: parseFetchedResearchSources(result.sources) }
            : {}),
          sourceCount:
            typeof result.sourceCount === "number" && Number.isFinite(result.sourceCount)
              ? result.sourceCount
              : null,
          findingCount:
            typeof result.findingCount === "number" && Number.isFinite(result.findingCount)
              ? result.findingCount
              : null,
        }
      : null,
  };
};

const artifactValue = (value: unknown): AuthoringTurnPart["artifact"] => {
  if (value === null || value === undefined) return null;
  const artifact = objectValue(value);
  const artifactKind = artifact?.artifactKind;
  const artifactId = stringValue(artifact?.artifactId);
  if (
    !artifact ||
    (artifactKind !== AUTHORING_ARTIFACT_KIND.PROPOSAL &&
      artifactKind !== AUTHORING_ARTIFACT_KIND.QUESTION) ||
    !artifactId
  ) {
    return null;
  }

  return { artifactKind, artifactId };
};

type CanonicalTurnUpdate = {
  turn: Pick<
    AuthoringTurn,
    "requestId" | "messageId" | "status" | "taskIds" | "firstSequence" | "updatedSequence"
  >;
  part: AuthoringTurnPart | null;
};

const canonicalTurnUpdate = (event: AuthoringEvent): CanonicalTurnUpdate | null => {
  const eventSequence = integerValue(event.sequence, 1);
  if (eventSequence === null) return null;

  const payload = objectValue(event.payload);
  const rawTurn = objectValue(payload?.turn);
  const requestId = stringValue(rawTurn?.requestId);
  const messageId = stringValue(rawTurn?.messageId);
  const status = rawTurn?.status;
  const firstSequence = integerValue(rawTurn?.firstSequence, 1);
  const updatedSequence = integerValue(rawTurn?.updatedSequence, 1);
  const taskIds = rawTurn?.taskIds;
  if (
    !rawTurn ||
    !requestId ||
    !messageId ||
    !isTurnStatus(status) ||
    firstSequence === null ||
    updatedSequence === null ||
    updatedSequence !== eventSequence ||
    !Array.isArray(taskIds) ||
    taskIds.some((taskId) => !stringValue(taskId))
  ) {
    return null;
  }

  const rawPart =
    rawTurn.part === null || rawTurn.part === undefined ? null : objectValue(rawTurn.part);
  if (rawTurn.part !== null && rawTurn.part !== undefined && !rawPart) return null;
  if (!rawPart) {
    return {
      turn: {
        requestId,
        messageId,
        status,
        taskIds: taskIds as string[],
        firstSequence,
        updatedSequence,
      },
      part: null,
    };
  }

  const partRequestId = stringValue(rawPart.requestId);
  const partMessageId = stringValue(rawPart.messageId);
  const partId = stringValue(rawPart.partId);
  const partKind = rawPart.partKind;
  const partStatus = rawPart.status;
  const partFirstSequence = integerValue(rawPart.firstSequence, 1);
  const partUpdatedSequence = integerValue(rawPart.updatedSequence, 1);
  const taskId =
    rawPart.taskId === null || rawPart.taskId === undefined ? null : stringValue(rawPart.taskId);
  if (
    !partRequestId ||
    !partMessageId ||
    partRequestId !== requestId ||
    partMessageId !== messageId ||
    !partId ||
    !isPartKind(partKind) ||
    !isPartStatus(partStatus) ||
    partFirstSequence === null ||
    partUpdatedSequence === null ||
    partUpdatedSequence !== eventSequence ||
    (rawPart.taskId !== null && rawPart.taskId !== undefined && !taskId)
  ) {
    return null;
  }

  const text =
    rawPart.text === null || rawPart.text === undefined
      ? null
      : typeof rawPart.text === "string"
        ? rawPart.text
        : null;
  if (rawPart.text !== null && rawPart.text !== undefined && text === null) return null;
  const answer =
    rawPart.answer === null || rawPart.answer === undefined
      ? null
      : typeof rawPart.answer === "string"
        ? rawPart.answer
        : null;
  if (rawPart.answer !== null && rawPart.answer !== undefined && answer === null) return null;
  const phase = typeof rawPart.phase === "string" ? rawPart.phase : null;
  const planSteps = Array.isArray(rawPart.planSteps)
    ? rawPart.planSteps.filter((step): step is string => typeof step === "string").slice(0, 6)
    : undefined;

  return {
    turn: {
      requestId,
      messageId,
      status,
      taskIds: taskIds as string[],
      firstSequence,
      updatedSequence,
    },
    part: {
      requestId: partRequestId,
      messageId: partMessageId,
      partId,
      partKind,
      taskId,
      status: partStatus,
      firstSequence: partFirstSequence,
      updatedSequence: partUpdatedSequence,
      text,
      ...(planSteps ? { planSteps } : {}),
      ...(answer !== null ? { answer } : {}),
      phase,
      tool: toolValue(rawPart.tool),
      artifact: artifactValue(rawPart.artifact),
    },
  };
};

const partChunk = (
  part: AuthoringTurnPart,
): UIMessageChunk<AuthoringChatMetadata, AuthoringChatDataTypes> => ({
  type: "data-authoringPart",
  id: part.partId,
  data: {
    requestId: part.requestId,
    messageId: part.messageId,
    taskId: part.taskId ?? null,
    partId: part.partId,
    partKind: part.partKind,
    status: part.status,
    firstSequence: part.firstSequence,
    updatedSequence: part.updatedSequence,
    text: part.text ?? null,
    ...(part.planSteps ? { planSteps: part.planSteps } : {}),
    ...(part.answer !== undefined ? { answer: part.answer } : {}),
    phase: part.phase ?? null,
    tool: part.tool ?? null,
    artifact: part.artifact ?? null,
  },
});

const messageMetadataChunk = (
  requestId: string,
  turnStatus: AuthoringTurnStatus,
  updatedSequence: number,
): UIMessageChunk<AuthoringChatMetadata, AuthoringChatDataTypes> => ({
  type: "message-metadata",
  messageMetadata: { requestId, turnStatus, updatedSequence },
});

const toolChunk = (
  part: AuthoringTurnPart,
): UIMessageChunk<AuthoringChatMetadata, AuthoringChatDataTypes> | null => {
  if (part.partKind !== AUTHORING_PART_KIND.TOOL || !part.tool) return null;
  return {
    type: "data-authoringTool",
    id: part.partId,
    data: {
      requestId: part.requestId,
      taskId: part.taskId ?? null,
      partId: part.partId,
      toolCallId: part.tool.toolCallId,
      toolName: part.tool.toolName,
      display: part.tool.display,
      status: part.tool.status,
      result: part.tool.result ?? null,
    },
  };
};

const proposalChunk = (
  part: AuthoringTurnPart,
): UIMessageChunk<AuthoringChatMetadata, AuthoringChatDataTypes> | null => {
  if (
    part.partKind !== AUTHORING_PART_KIND.PROPOSAL ||
    part.artifact?.artifactKind !== AUTHORING_ARTIFACT_KIND.PROPOSAL
  )
    return null;
  return {
    type: "data-authoringProposal",
    id: part.partId,
    data: {
      requestId: part.requestId,
      taskId: part.taskId ?? null,
      partId: part.partId,
      proposalId: part.artifact.artifactId,
      revision: null,
    },
  };
};

const terminalTurnStatuses = new Set<AuthoringTurnStatus>([
  AUTHORING_TURN_STATUS.WAITING_AUTHOR,
  AUTHORING_TURN_STATUS.COMPLETED,
  AUTHORING_TURN_STATUS.FAILED,
  AUTHORING_TURN_STATUS.STOPPED,
]);

/** Creates one SDK stream for a durable authoring request. Cancellation only unsubscribes. */
const createRequestStream = (
  requestIdPromise: Promise<string>,
  options: TransportOptions,
  abortSignal?: AbortSignal,
) => {
  let cancelStream = () => {};

  return new ReadableStream<UIMessageChunk<AuthoringChatMetadata, AuthoringChatDataTypes>>({
    start(controller) {
      let requestId: string | null = null;
      let closed = false;
      let abortListener: (() => void) | undefined;
      let unsubscribe = () => {};
      let unsubscribeSnapshot = () => {};
      const pendingEvents: AuthoringEvent[] = [];
      const seenPartSequences = new Map<string, number>();
      const textByPartId = new Map<string, string>();
      const openTextParts = new Set<string>();

      const removeAbortListener = () => {
        if (abortListener) abortSignal?.removeEventListener("abort", abortListener);
        abortListener = undefined;
      };

      const cleanup = () => {
        unsubscribe();
        unsubscribeSnapshot();
        removeAbortListener();
      };

      const endTextPart = (partId: string) => {
        if (!openTextParts.delete(partId)) return;
        controller.enqueue({ type: "text-end", id: partId });
      };

      const endAllTextParts = () => {
        [...openTextParts].forEach(endTextPart);
      };

      const close = (status: AuthoringTurnStatus, updatedSequence: number) => {
        if (closed) return;
        closed = true;
        endAllTextParts();
        cleanup();
        if (requestId) {
          controller.enqueue(messageMetadataChunk(requestId, status, updatedSequence));
        }
        controller.enqueue({
          type: "finish",
          finishReason: status === AUTHORING_TURN_STATUS.FAILED ? "error" : "stop",
        });
        controller.close();
      };

      const reconcileSnapshot = () => {
        if (closed || !requestId) return;

        const turn = options
          .getSession()
          ?.turns?.find((candidate) => candidate.requestId === requestId);
        if (turn && terminalTurnStatuses.has(turn.status)) {
          close(turn.status, turn.updatedSequence);
          return;
        }
      };

      const handleAbort = () => {
        if (closed) return;
        closed = true;
        cleanup();
        controller.enqueue({ type: "abort", reason: "client-aborted" });
        controller.close();
      };

      const startResponse = (resolvedRequestId: string) => {
        requestId = resolvedRequestId;
        const messageId =
          options.getSession()?.turns?.find((turn) => turn.requestId === resolvedRequestId)
            ?.messageId ?? `${resolvedRequestId}-assistant`;
        controller.enqueue({
          type: "start",
          messageId,
          messageMetadata: {
            requestId: resolvedRequestId,
            turnStatus: AUTHORING_TURN_STATUS.RUNNING,
          },
        });
      };

      const emitTextPart = (part: AuthoringTurnPart) => {
        if (part.partKind !== AUTHORING_PART_KIND.TEXT) return;

        endAllTextParts();
        const priorText = textByPartId.get(part.partId);
        const nextText = part.text ?? "";
        controller.enqueue(partChunk(part));

        if (priorText === undefined) {
          controller.enqueue({ type: "text-start", id: part.partId });
          openTextParts.add(part.partId);
          if (nextText)
            controller.enqueue({ type: "text-delta", id: part.partId, delta: nextText });
        } else if (nextText.startsWith(priorText)) {
          const delta = nextText.slice(priorText.length);
          if (!openTextParts.has(part.partId)) {
            controller.enqueue({ type: "text-start", id: part.partId });
            openTextParts.add(part.partId);
          }
          if (delta) controller.enqueue({ type: "text-delta", id: part.partId, delta });
        }

        textByPartId.set(part.partId, nextText);
        if (part.status !== AUTHORING_PART_STATUS.STREAMING) endTextPart(part.partId);
      };

      const handleEvent = (event: AuthoringEvent) => {
        if (closed) return;

        const update = canonicalTurnUpdate(event);
        if (!update) return;
        if (!requestId) {
          pendingEvents.push(event);
          return;
        }
        if (update.turn.requestId !== requestId) return;

        const part = update.part;
        if (part) {
          const priorSequence = seenPartSequences.get(part.partId);
          if (priorSequence === undefined || part.updatedSequence > priorSequence) {
            seenPartSequences.set(part.partId, part.updatedSequence);
            if (part.partKind === AUTHORING_PART_KIND.TEXT) {
              emitTextPart(part);
            } else {
              endAllTextParts();
              controller.enqueue(partChunk(part));
              const tool = toolChunk(part);
              if (tool) controller.enqueue(tool);
              const proposal = proposalChunk(part);
              if (proposal) controller.enqueue(proposal);
            }
          }
        }

        controller.enqueue(
          messageMetadataChunk(requestId, update.turn.status, update.turn.updatedSequence),
        );
        if (terminalTurnStatuses.has(update.turn.status)) {
          close(update.turn.status, update.turn.updatedSequence);
        }
      };

      cancelStream = () => {
        if (closed) return;
        closed = true;
        cleanup();
      };

      unsubscribe = options.subscribe(handleEvent);
      if (abortSignal?.aborted) {
        handleAbort();
        return;
      }
      abortListener = handleAbort;
      abortSignal?.addEventListener("abort", abortListener, { once: true });

      void requestIdPromise.then(
        (resolvedRequestId) => {
          if (closed) return;
          startResponse(resolvedRequestId);
          pendingEvents.splice(0).forEach(handleEvent);
          if (!closed) {
            unsubscribeSnapshot = options.subscribeSnapshot?.(reconcileSnapshot) ?? (() => {});
            reconcileSnapshot();
          }
        },
        (error: unknown) => {
          if (closed) return;
          closed = true;
          cleanup();
          controller.enqueue({
            type: "error",
            errorText: error instanceof Error ? error.message : "AUTHORING_COMMAND_FAILED",
          });
          controller.close();
        },
      );
    },
    cancel() {
      cancelStream();
    },
  });
};

const requestFromBody = (body: object | undefined): AuthoringRequest | null => {
  const value = objectValue(body)?.request;
  return objectValue(value) as AuthoringRequest | null;
};

const commandIdFromBody = (body: object | undefined): string =>
  stringValue(objectValue(body)?.commandId) ?? crypto.randomUUID();

/** Bridges REST command receipts and ordered typed turn events into AI SDK UI chunks. */
export const createAuthoringChatTransport = (
  options: TransportOptions,
): ChatTransport<AuthoringChatMessage> => ({
  async sendMessages(sendOptions: SendOptions) {
    const request = requestFromBody(sendOptions.body);
    const instruction = textFromMessage(sendOptions.messages.at(-1));
    if (!request) throw new Error("AUTHORING_REQUEST_BODY_REQUIRED");

    const commandId = commandIdFromBody(sendOptions.body);
    const requestIdPromise = options
      .sendCommand({
        action: "request.create",
        request: { ...request, instruction: request.instruction || instruction },
        commandId,
      })
      .then((receipt) => {
        if (!receipt.requestId) throw new Error("AUTHORING_REQUEST_ID_MISSING");
        return receipt.requestId;
      });

    return createRequestStream(requestIdPromise, options, sendOptions.abortSignal);
  },

  async reconnectToStream(reconnectOptions: ReconnectOptions) {
    const requestId = stringValue(objectValue(reconnectOptions.body)?.requestId);
    if (!requestId) return null;
    const turn = options
      .getSession()
      ?.turns?.find((candidate) => candidate.requestId === requestId);
    if (!turn || terminalTurnStatuses.has(turn.status)) return null;

    return createRequestStream(Promise.resolve(requestId), options);
  },
});
