import { useChat } from "@ai-sdk/react";
import { getUiMessageText } from "@repo/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createAuthoringChatTransport } from "../authoringChatTransport";
import {
  authoringMessagesFromTurns,
  canonicalAuthoringTurns,
  messageSequence,
  partIdentity,
} from "../authoringConversation";

import type {
  AuthoringChatDataTypes,
  AuthoringChatMessage,
  AuthoringChatMetadata,
} from "../authoringChatTransport";
import type {
  AuthoringCommand,
  AuthoringEvent,
  AuthoringRequest,
  AuthoringSession,
  AuthoringTurn,
  ConversationMessageView,
} from "../courseAuthoring.types";

type Options = {
  chatId: string;
  conversation: ConversationMessageView[];
  turns?: AuthoringTurn[];
  sendCommand: (
    command: Omit<AuthoringCommand, "schemaVersion" | "commandId"> & { commandId: string },
  ) => Promise<{ requestId?: string | null }>;
  subscribe: (listener: (event: AuthoringEvent) => void) => () => void;
  getSession: () => AuthoringSession | undefined;
};

const durableMessages = (
  conversation: ConversationMessageView[],
  turns?: AuthoringTurn[],
): AuthoringChatMessage[] =>
  authoringMessagesFromTurns(canonicalAuthoringTurns(turns, conversation));

const acceptedRequestOwner = (event: AuthoringEvent) => {
  if (event.type !== "command.accepted") return null;
  const { action, commandId, requestId } = event.payload;
  if (
    action !== "request.create" ||
    typeof commandId !== "string" ||
    typeof requestId !== "string"
  ) {
    return null;
  }
  return { commandId, requestId };
};

const assistantPartSequence = (message: AuthoringChatMessage): number =>
  message.parts.reduce((latest, part) => {
    if (part.type !== "data-authoringPart") return latest;
    return Math.max(latest, part.data.updatedSequence);
  }, -1);

const mergeAssistantParts = (
  preferred: AuthoringChatMessage,
  other: AuthoringChatMessage,
): AuthoringChatMessage["parts"] => {
  const parts = [...preferred.parts];
  other.parts.forEach((candidate) => {
    if (candidate.type !== "data-authoringPart") return;
    const identity = partIdentity(candidate);
    const index = parts.findIndex((part) => partIdentity(part) === identity);
    if (index < 0) {
      parts.push(candidate);
      return;
    }
    const current = parts[index];
    if (
      current.type === "data-authoringPart" &&
      candidate.data.updatedSequence > current.data.updatedSequence
    ) {
      parts[index] = {
        ...candidate,
        data: {
          ...candidate.data,
          planSteps: candidate.data.planSteps?.length
            ? candidate.data.planSteps
            : current.data.planSteps,
        },
      };
    }
  });
  return parts;
};

/*
 * Keep durable records in request order while preserving any SDK-owned optimistic
 * or streaming messages that are not in the latest snapshot yet.
 */
const mergeDurableMessages = (
  current: AuthoringChatMessage[],
  durable: AuthoringChatMessage[],
  requestIdByCommandId: Map<string, string>,
): AuthoringChatMessage[] => {
  const durableById = new Map(durable.map((message) => [message.id, message]));
  const consumedIds = new Set<string>();
  const merged = durable.map((message) => {
    const requestId = message.metadata?.requestId;
    const sameOwnedTurn = current.filter(
      (candidate) =>
        candidate.role === message.role &&
        Boolean(requestId) &&
        (candidate.metadata?.requestId === requestId ||
          (candidate.role === "user" &&
            typeof candidate.metadata?.commandId === "string" &&
            requestIdByCommandId.get(candidate.metadata.commandId) === requestId)),
    );
    const exact = current.find((candidate) => candidate.id === message.id);
    const optimisticRequestOwner =
      message.role === "user"
        ? sameOwnedTurn.find(
            (candidate) =>
              typeof candidate.metadata?.commandId === "string" &&
              requestIdByCommandId.get(candidate.metadata.commandId) === requestId,
          )
        : undefined;
    const existing =
      optimisticRequestOwner ??
      exact ??
      (sameOwnedTurn.length > 0
        ? sameOwnedTurn.reduce((latest, candidate) =>
            messageSequence(candidate) >= messageSequence(latest) ? candidate : latest,
          )
        : undefined);
    sameOwnedTurn.forEach((candidate) => consumedIds.add(candidate.id));
    if (exact) consumedIds.add(exact.id);
    if (!existing) return message;
    if (existing.role !== message.role) return message;
    if (message.role !== "assistant") {
      return {
        ...message,
        id: existing.id,
        metadata: { ...existing.metadata, ...message.metadata },
      };
    }
    // An empty SDK placeholder can carry newer turn metadata without any visible content.
    // Prefer the durable assistant in that case, and retain SDK parts only when their own
    // sequence is ahead of the durable part sequence.
    const existingHasNewerParts = assistantPartSequence(existing) > assistantPartSequence(message);
    const existingMetadataSequence = existing.metadata?.updatedSequence ?? -1;
    const durableMetadataSequence = message.metadata?.updatedSequence ?? -1;
    const owner = existingHasNewerParts ? existing : message;
    const parts = sameOwnedTurn.reduce<AuthoringChatMessage["parts"]>(
      (mergedParts, candidate) => mergeAssistantParts({ ...owner, parts: mergedParts }, candidate),
      mergeAssistantParts(owner, owner === existing ? message : existing),
    );
    return {
      ...owner,
      id: existing.id,
      parts,
      metadata:
        existingMetadataSequence > durableMetadataSequence
          ? { ...message.metadata, ...existing.metadata }
          : { ...existing.metadata, ...message.metadata },
    };
  });

  current.forEach((message) => {
    if (!durableById.has(message.id) && !consumedIds.has(message.id) && message.metadata) {
      merged.push(message);
    }
  });
  const unchanged =
    merged.length === current.length &&
    merged.every((message, index) => {
      const prior = current[index];
      return (
        prior?.id === message.id &&
        prior.role === message.role &&
        getUiMessageText(prior) === getUiMessageText(message) &&
        JSON.stringify(prior.parts) === JSON.stringify(message.parts) &&
        JSON.stringify(prior.metadata) === JSON.stringify(message.metadata)
      );
    });
  return unchanged ? current : merged;
};

/** Owns the SDK transcript while durable session records remain the recovery source. */
export const useCourseAuthoringChat = ({
  chatId,
  conversation,
  turns,
  sendCommand,
  subscribe,
  getSession,
}: Options) => {
  const requestByCommandIdRef = useRef(new Map<string, AuthoringRequest>());
  const [requestIdByCommandId, setRequestIdByCommandId] = useState(() => new Map<string, string>());
  const requestIdByCommandIdRef = useRef(requestIdByCommandId);
  const latestCommandIdRef = useRef<string | null>(null);
  const snapshotListenersRef = useRef(new Set<() => void>());
  const durableConversationKey = JSON.stringify({ conversation, turns });
  const durableProjectionRef = useRef({
    key: "",
    messages: [] as AuthoringChatMessage[],
  });
  if (durableProjectionRef.current.key !== durableConversationKey) {
    durableProjectionRef.current = {
      key: durableConversationKey,
      messages: durableMessages(conversation, turns),
    };
  }
  const projectedDurableMessages = durableProjectionRef.current.messages;
  const subscribeSnapshot = useCallback((listener: () => void) => {
    snapshotListenersRef.current.add(listener);
    return () => snapshotListenersRef.current.delete(listener);
  }, []);
  const rememberRequestOwner = useCallback((commandId: string, requestId: string) => {
    if (requestIdByCommandIdRef.current.get(commandId) === requestId) return;
    const nextOwners = new Map(requestIdByCommandIdRef.current);
    nextOwners.set(commandId, requestId);
    requestIdByCommandIdRef.current = nextOwners;
    setRequestIdByCommandId(nextOwners);
  }, []);
  const subscribeWithRequestOwnership = useCallback(
    (listener: (event: AuthoringEvent) => void) =>
      subscribe((event) => {
        const owner = acceptedRequestOwner(event);
        if (owner) rememberRequestOwner(owner.commandId, owner.requestId);
        listener(event);
      }),
    [rememberRequestOwner, subscribe],
  );
  const transport = useMemo(
    () =>
      createAuthoringChatTransport({
        sendCommand: async (command) => {
          const receipt = await sendCommand(command);
          if (receipt.requestId) {
            rememberRequestOwner(command.commandId, receipt.requestId);
          }
          return receipt;
        },
        subscribe: subscribeWithRequestOwnership,
        subscribeSnapshot,
        getSession,
      }),
    [
      getSession,
      rememberRequestOwner,
      sendCommand,
      subscribeSnapshot,
      subscribeWithRequestOwnership,
    ],
  );
  const chat = useChat<AuthoringChatMessage>({ id: chatId, transport, resume: true });
  const { sendMessage, setMessages, stop: stopChat } = chat;

  const acknowledgedMessages = useMemo(
    () =>
      chat.messages.map((message) => {
        const commandId = message.metadata?.commandId;
        const requestId = commandId ? requestIdByCommandId.get(commandId) : undefined;
        if (!requestId || message.metadata?.requestId === requestId) return message;
        return { ...message, metadata: { ...message.metadata, requestId } };
      }),
    [chat.messages, requestIdByCommandId],
  );
  const awaitingRequestReceipt = useMemo(() => {
    if (chat.status !== "submitted" && chat.status !== "streaming") return false;
    const latestUserMessage = [...chat.messages]
      .reverse()
      .find((message) => message.role === "user");
    const commandId = latestUserMessage?.metadata?.commandId;
    return typeof commandId === "string" && !requestIdByCommandId.has(commandId);
  }, [chat.messages, chat.status, requestIdByCommandId]);
  const visibleMessages = useMemo(
    () =>
      awaitingRequestReceipt
        ? acknowledgedMessages
        : mergeDurableMessages(
            acknowledgedMessages,
            projectedDurableMessages,
            requestIdByCommandId,
          ),
    [acknowledgedMessages, awaitingRequestReceipt, projectedDurableMessages, requestIdByCommandId],
  );

  useEffect(() => {
    snapshotListenersRef.current.forEach((listener) => listener());
  }, [turns]);

  useEffect(() => {
    // The accepted event or REST receipt establishes request ownership. Until then, keep the
    // SDK optimistic message as the only owner instead of briefly inserting its durable twin.
    if (awaitingRequestReceipt) return;
    setMessages((current) =>
      mergeDurableMessages(current, projectedDurableMessages, requestIdByCommandId),
    );
  }, [
    awaitingRequestReceipt,
    chat.status,
    projectedDurableMessages,
    requestIdByCommandId,
    setMessages,
  ]);

  useEffect(() => {
    setMessages((current) =>
      current.map((message) => {
        const commandId = message.metadata?.commandId;
        const requestId =
          typeof commandId === "string" ? requestIdByCommandId.get(commandId) : undefined;
        return requestId ? { ...message, metadata: { ...message.metadata, requestId } } : message;
      }),
    );
  }, [requestIdByCommandId, setMessages]);

  const sendRequest = useCallback(
    async (request: AuthoringRequest) => {
      const commandId = crypto.randomUUID();
      latestCommandIdRef.current = commandId;
      requestByCommandIdRef.current.set(commandId, request);
      await sendMessage(
        {
          id: commandId,
          role: "user",
          parts: [{ type: "text", text: request.instruction, state: "done" }],
          metadata: {
            commandId,
            sourceVersionIds: request.attachedSourceVersionIds ?? [],
          } satisfies AuthoringChatMetadata,
        },
        { body: { commandId, request } },
      );
    },
    [sendMessage],
  );

  const retryRequest = useCallback(
    async (commandId: string) => {
      const request = requestByCommandIdRef.current.get(commandId);
      if (!request) return;
      await sendMessage(
        {
          id: commandId,
          role: "user",
          parts: [{ type: "text", text: request.instruction, state: "done" }],
          metadata: {
            commandId,
            sourceVersionIds: request.attachedSourceVersionIds ?? [],
          } satisfies AuthoringChatMetadata,
        },
        {
          body: {
            commandId,
            request,
            requestId: requestIdByCommandIdRef.current.get(commandId),
          },
        },
      );
    },
    [sendMessage],
  );

  const retryLatestRequest = useCallback(async () => {
    if (!latestCommandIdRef.current) return;
    await retryRequest(latestCommandIdRef.current);
  }, [retryRequest]);

  const stop = useCallback(() => {
    stopChat();
  }, [stopChat]);

  return {
    ...chat,
    messages: visibleMessages,
    awaitingRequestReceipt,
    sendRequest,
    retryRequest,
    retryLatestRequest,
    stop,
  };
};

export type { AuthoringChatDataTypes, AuthoringChatMessage };
export { durableMessages, mergeDurableMessages };
