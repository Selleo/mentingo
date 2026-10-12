import type { AuthoringChatDataTypes, AuthoringChatMessage } from "./authoringChatTransport";
import type {
  AuthoringTurn,
  AuthoringTurnPart,
  ConversationMessageView,
} from "./courseAuthoring.types";

type RequestEntry = ConversationMessageView & { kind: "request" };

export type AuthoringConversationTurn = {
  requestId: string;
  messageId: string;
  firstSequence: number;
  request?: RequestEntry;
  status: AuthoringTurn["status"];
  parts: AuthoringTurnPart[];
  updatedSequence: number;
};

export type AuthoringTimelineDecorationKind =
  | "plan"
  | "question"
  | "preview"
  | "activity"
  | "proposalGroup"
  | "pending";

export type AuthoringTimelineDecoration<T> = {
  id: string;
  requestId: string;
  kind: AuthoringTimelineDecorationKind;
  value: T;
  taskId?: string | null;
  partId?: string | null;
  artifactIds?: string[];
  sequence?: number;
};

export type AuthoringTimelineItem<T> =
  | {
      kind: "request";
      id: string;
      requestId: string;
      sequence: number;
      order: number;
      message: AuthoringChatMessage;
    }
  | {
      kind: "part";
      id: string;
      requestId: string;
      sequence: number;
      order: number;
      message: AuthoringChatMessage;
      part: Extract<AuthoringChatMessage["parts"][number], { type: "data-authoringPart" }>;
    }
  | {
      kind: AuthoringTimelineDecorationKind;
      id: string;
      requestId: string;
      sequence: number;
      order: number;
      value: T;
    };

/** Keeps non-conversational background turns (for example source ingestion) out of chat UI state. */
export const activeAssistantRequestIds = (
  turns: AuthoringTurn[] | undefined,
  conversation: ConversationMessageView[],
  chatMessages: AuthoringChatMessage[] = [],
): Set<string> => {
  const durableRequestIds = new Set(
    conversation
      .filter((entry): entry is RequestEntry => entry.kind === "request")
      .map((entry) => entry.value.requestId),
  );
  const latestTerminalChatSequenceByRequest = new Map<string, number>();
  chatMessages.forEach((message) => {
    if (message.role !== "assistant" || !message.metadata?.requestId) return;
    if (
      !["waiting_author", "completed", "failed", "stopped"].includes(
        message.metadata.turnStatus ?? "",
      )
    ) {
      return;
    }
    const sequence = message.metadata.updatedSequence;
    if (typeof sequence !== "number" || !Number.isSafeInteger(sequence)) return;
    const prior = latestTerminalChatSequenceByRequest.get(message.metadata.requestId) ?? -1;
    if (sequence >= prior) {
      latestTerminalChatSequenceByRequest.set(message.metadata.requestId, sequence);
    }
  });

  return new Set(
    (turns ?? [])
      .filter(
        (turn) =>
          (turn.status === "queued" || turn.status === "running") &&
          durableRequestIds.has(turn.requestId) &&
          (latestTerminalChatSequenceByRequest.get(turn.requestId) ?? -1) < turn.updatedSequence,
      )
      .map((turn) => turn.requestId),
  );
};

/** Returns the root request identity while the latest SDK-owned user message is in flight. */
export const activeChatRequestId = (
  messages: AuthoringChatMessage[],
  status: string,
): string | null => {
  if (status !== "submitted" && status !== "streaming") return null;
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUserMessage) return null;
  return (
    latestUserMessage.metadata?.requestId ??
    latestUserMessage.metadata?.commandId ??
    latestUserMessage.id
  );
};

const numberValue = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : null;

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const dedupeParts = (parts: AuthoringTurnPart[]): AuthoringTurnPart[] => {
  const latest = new Map<string, AuthoringTurnPart>();

  parts.forEach((part) => {
    const prior = latest.get(part.partId);
    if (!prior || part.updatedSequence >= prior.updatedSequence) latest.set(part.partId, part);
  });

  return [...latest.values()].sort(
    (left, right) =>
      left.firstSequence - right.firstSequence || left.partId.localeCompare(right.partId),
  );
};

const messageRequestId = (message: AuthoringChatMessage): string =>
  message.metadata?.requestId ?? message.id.replace(/-assistant$/, "");

const messageSequenceValue = (
  message: AuthoringChatMessage,
  key: "firstSequence" | "updatedSequence",
): number | null => numberValue((message.metadata as Record<string, unknown> | undefined)?.[key]);

const timelinePriority = (kind: AuthoringTimelineItem<unknown>["kind"]): number => {
  if (kind === "request") return 0;
  if (kind === "part") return 1;
  if (kind === "plan") return 2;
  if (kind === "question") return 2;
  if (kind === "preview") return 3;
  if (kind === "proposalGroup") return 4;
  if (kind === "activity") return 5;
  return 6;
};

/** Returns the stable display position of one durable authoring part. */
export const authoringPartTimelineSequence = (
  part: AuthoringChatMessage["parts"][number],
): number | null => {
  if (part.type !== "data-authoringPart") return null;
  const firstSequence = numberValue(part.data.firstSequence);
  const updatedSequence = numberValue(part.data.updatedSequence);
  if (part.data.partKind === "question" || part.data.partKind === "proposal") {
    return firstSequence ?? updatedSequence;
  }
  if (updatedSequence !== null && (firstSequence === null || updatedSequence > firstSequence)) {
    return updatedSequence;
  }
  return firstSequence ?? updatedSequence;
};

const authoringPartMarkers = (message: AuthoringChatMessage) =>
  message.parts.filter(
    (
      part,
    ): part is Extract<AuthoringChatMessage["parts"][number], { type: "data-authoringPart" }> =>
      part.type === "data-authoringPart",
  );

const fallbackRequestSequence = (
  message: AuthoringChatMessage | undefined,
  parts: ReturnType<typeof authoringPartMarkers>,
  fallback: number,
): number => {
  const stored = message && messageSequenceValue(message, "firstSequence");
  if (stored !== null && stored !== undefined) return stored;
  const partSequence = parts
    .map((part) => numberValue(part.data.firstSequence))
    .filter((sequence): sequence is number => sequence !== null)
    .sort((left, right) => left - right)[0];
  return partSequence === undefined ? fallback : Math.max(0, partSequence - 0.25);
};

/**
 * Projects chat parts and identity-linked decorations into one durable transcript order.
 * Questions and proposals keep their creation position; mutable text/tool stages follow their
 * latest event. Decorations attach to exact part/artifact/task identities before using fallbacks.
 */
export const projectAuthoringTimeline = <T>(
  messages: AuthoringChatMessage[],
  decorations: AuthoringTimelineDecoration<T>[] = [],
): AuthoringTimelineItem<T>[] => {
  const messagesByRequest = new Map<string, AuthoringChatMessage[]>();
  messages.forEach((message) => {
    const requestId = messageRequestId(message);
    messagesByRequest.set(requestId, [...(messagesByRequest.get(requestId) ?? []), message]);
  });

  const latestPartByIdentity = new Map<
    string,
    {
      message: AuthoringChatMessage;
      part: ReturnType<typeof authoringPartMarkers>[number];
      messageOrder: number;
      partOrder: number;
    }
  >();
  messages.forEach((message, messageOrder) => {
    if (message.role !== "assistant") return;
    const requestId = messageRequestId(message);
    authoringPartMarkers(message).forEach((part, partOrder) => {
      let identity = `part:${part.data.partId}`;
      if (part.data.partKind === "tool" && part.data.tool) {
        identity = `tool:${part.data.taskId ?? "request"}:${part.data.tool.toolCallId}`;
      } else if (part.data.artifact) {
        identity = `artifact:${part.data.artifact.artifactKind}:${part.data.artifact.artifactId}`;
      }
      const key = `${requestId}:${identity}`;
      const prior = latestPartByIdentity.get(key);
      if (!prior || part.data.updatedSequence >= prior.part.data.updatedSequence) {
        latestPartByIdentity.set(key, { message, part, messageOrder, partOrder });
      }
    });
  });
  const partEntries = [...latestPartByIdentity.values()].flatMap(
    ({ message, part, messageOrder, partOrder }) => {
      const requestId = messageRequestId(message);
      const sequence = authoringPartTimelineSequence(part);
      if (sequence === null) return [];
      return [
        {
          kind: "part" as const,
          id: part.data.partId,
          requestId,
          sequence,
          order: messageOrder * 1000 + partOrder,
          message,
          part,
        },
      ];
    },
  );

  const requestMessageById = new Map<string, { message: AuthoringChatMessage; order: number }>();
  messages.forEach((message, order) => {
    if (message.role !== "user") return;
    const requestId = messageRequestId(message);
    const prior = requestMessageById.get(requestId);
    if (!prior || (!prior.message.metadata?.commandId && message.metadata?.commandId)) {
      requestMessageById.set(requestId, { message, order });
    }
  });
  const requests = [...requestMessageById.entries()].map(([requestId, entry]) => {
    const parts = (messagesByRequest.get(requestId) ?? []).flatMap(authoringPartMarkers);
    const sequence = fallbackRequestSequence(
      entry.message,
      parts,
      Number.MAX_SAFE_INTEGER / 4 + entry.order,
    );
    return {
      kind: "request" as const,
      id: entry.message.id,
      requestId,
      sequence,
      order: entry.order * 1000,
      message: entry.message,
    };
  });

  const seenDecorationOwners = new Set<string>();
  const decorationEntries = decorations.flatMap((decoration, order) => {
    let ownerKey = `${decoration.kind}:${decoration.requestId}:${decoration.id}`;
    if (decoration.kind === "pending") {
      ownerKey = `${decoration.kind}:${decoration.requestId}`;
    } else if (decoration.kind === "activity" && decoration.taskId) {
      ownerKey = `${decoration.kind}:${decoration.requestId}:${decoration.taskId}`;
    }
    if (seenDecorationOwners.has(ownerKey)) return [];
    seenDecorationOwners.add(ownerKey);

    const requestMessages = messagesByRequest.get(decoration.requestId) ?? [];
    const requestParts = requestMessages.flatMap(authoringPartMarkers);
    const artifactIds = new Set(decoration.artifactIds ?? []);
    const matchingParts = requestParts.filter(
      (part) =>
        (decoration.partId && part.data.partId === decoration.partId) ||
        (artifactIds.size > 0 &&
          part.data.artifact != null &&
          artifactIds.has(part.data.artifact.artifactId)),
    );
    const exactPart =
      matchingParts.find((part) => part.data.partId === decoration.partId) ??
      matchingParts.reduce<(typeof matchingParts)[number] | undefined>((latest, part) => {
        if (!latest) return part;
        return (authoringPartTimelineSequence(part) ?? -1) >=
          (authoringPartTimelineSequence(latest) ?? -1)
          ? part
          : latest;
      }, undefined);
    const taskParts = decoration.taskId
      ? requestParts.filter((part) => part.data.taskId === decoration.taskId)
      : [];
    const requestMessage = requestMessages.find((message) => message.role === "user");
    const assistantMessage = requestMessages.find((message) => message.role === "assistant");
    let sequence = decoration.sequence ?? null;

    if (decoration.kind === "question" && exactPart?.data.partKind === "question") {
      // The question part itself renders the card at its original event position.
      return [];
    }
    if (sequence === null && exactPart) {
      sequence =
        decoration.kind === "plan" || decoration.kind === "proposalGroup"
          ? numberValue(exactPart.data.firstSequence)
          : authoringPartTimelineSequence(exactPart);
    }
    if (sequence === null && decoration.kind === "question" && taskParts.length > 0) {
      const firstSequences = taskParts.flatMap((part) => {
        const first = numberValue(part.data.firstSequence);
        return first === null ? [] : [first];
      });
      if (firstSequences.length > 0) sequence = Math.min(...firstSequences);
    }
    if (sequence === null && taskParts.length > 0) {
      const activityParts =
        decoration.kind === "activity"
          ? taskParts.filter((part) => part.data.partKind === "tool")
          : taskParts;
      const sequenceParts = activityParts.length > 0 ? activityParts : taskParts;
      const taskSequences = sequenceParts.flatMap((part) => {
        const updated = numberValue(part.data.updatedSequence);
        const first = numberValue(part.data.firstSequence);
        return updated !== null ? [updated] : first !== null ? [first] : [];
      });
      if (taskSequences.length > 0) sequence = Math.max(...taskSequences);
    }
    if (sequence === null) {
      sequence = fallbackRequestSequence(
        assistantMessage ?? requestMessage,
        requestParts,
        Number.MAX_SAFE_INTEGER / 4 + messages.length + order,
      );
    }

    return [
      {
        kind: decoration.kind,
        id: decoration.id,
        requestId: decoration.requestId,
        sequence,
        order: messages.length * 1000 + order,
        value: decoration.value,
      },
    ];
  });

  return [...requests, ...partEntries, ...decorationEntries].sort((left, right) => {
    if (left.kind === "pending" && right.kind !== "pending") return 1;
    if (right.kind === "pending" && left.kind !== "pending") return -1;
    return (
      left.sequence - right.sequence ||
      timelinePriority(left.kind) - timelinePriority(right.kind) ||
      left.order - right.order
    );
  });
};

/** Normalizes durable server turns once before they enter the SDK transcript. */
export const canonicalAuthoringTurns = (
  turns: AuthoringTurn[] | undefined,
  conversation: ConversationMessageView[],
): AuthoringConversationTurn[] => {
  if (!turns) return [];

  const requestById = new Map(
    conversation
      .filter((entry): entry is RequestEntry => entry.kind === "request")
      .map((entry) => [entry.value.requestId, entry]),
  );

  return turns
    .map((turn) => ({
      requestId: turn.requestId,
      messageId: turn.messageId,
      firstSequence: turn.firstSequence,
      request: requestById.get(turn.requestId),
      status: turn.status,
      parts: dedupeParts(turn.parts),
      updatedSequence: turn.updatedSequence,
    }))
    .sort((left, right) => left.firstSequence - right.firstSequence);
};

const partData = (part: AuthoringTurnPart): AuthoringChatDataTypes["authoringPart"] => ({
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
});

const toUiParts = (parts: AuthoringTurnPart[]): AuthoringChatMessage["parts"] =>
  parts.reduce<AuthoringChatMessage["parts"]>((result, part) => {
    const marker = {
      type: "data-authoringPart" as const,
      id: part.partId,
      data: partData(part),
    };

    result.push(marker);
    return result;
  }, []);

/** Converts the canonical durable turns to the native AI SDK message shape. */
export const authoringMessagesFromTurns = (
  turns: AuthoringConversationTurn[],
): AuthoringChatMessage[] =>
  turns.flatMap((turn) => {
    if (!turn.request) return [];

    const messages: AuthoringChatMessage[] = [
      {
        id: `authoring-request-${turn.requestId}`,
        role: "user",
        parts: [{ type: "text", text: turn.request.value.instruction, state: "done" }],
        metadata: {
          requestId: turn.requestId,
          sourceVersionIds: turn.request.value.sourceVersionIds,
          firstSequence: turn.firstSequence,
          turnStatus: turn.status,
        },
      },
    ];

    if (turn.parts.length > 0) {
      messages.push({
        id: turn.messageId,
        role: "assistant",
        parts: toUiParts(turn.parts),
        metadata: {
          requestId: turn.requestId,
          firstSequence: turn.firstSequence,
          turnStatus: turn.status,
          updatedSequence: turn.updatedSequence,
        },
      });
    }

    return messages;
  });

export const messageSequence = (message: AuthoringChatMessage): number => {
  const metadataSequence = (message.metadata as { updatedSequence?: unknown } | undefined)
    ?.updatedSequence;
  const partSequences = message.parts.flatMap((part) => {
    if (part.type !== "data-authoringPart") return [];
    const data = part.data;
    const sequence = numberValue(data.updatedSequence);
    return sequence === null ? [] : [sequence];
  });

  return Math.max(typeof metadataSequence === "number" ? metadataSequence : -1, ...partSequences);
};

export const partIdentity = (part: AuthoringChatMessage["parts"][number]): string | null => {
  if (part.type === "data-authoringPart") {
    return stringValue(part.id) ?? stringValue(part.data.partId);
  }
  if (part.type === "data-authoringTool") {
    return stringValue(part.id) ?? stringValue(part.data.toolCallId);
  }
  if (part.type === "data-authoringProposal") {
    return stringValue(part.id) ?? stringValue(part.data.partId);
  }
  return null;
};
