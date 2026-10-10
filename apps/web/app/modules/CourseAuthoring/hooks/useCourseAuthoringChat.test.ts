import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  durableMessages,
  mergeDurableMessages,
  useCourseAuthoringChat,
  type AuthoringChatMessage,
} from "./useCourseAuthoringChat";

import type {
  AuthoringEvent,
  AuthoringRequest,
  AuthoringSession,
  AuthoringTurn,
  ConversationMessageView,
} from "../courseAuthoring.types";

const conversation = [
  {
    kind: "request" as const,
    value: {
      id: "record-1",
      requestId: "request-1",
      instruction: "First",
      createdAt: "2026-09-17",
      sourceVersionIds: [],
    },
  },
  {
    kind: "assistant" as const,
    value: {
      id: "assistant-1",
      requestId: "request-1",
      taskId: null,
      route: "assistant",
      message: "First answer",
    },
  },
  {
    kind: "request" as const,
    value: {
      id: "record-2",
      requestId: "request-2",
      instruction: "Second",
      createdAt: "2026-09-17",
      sourceVersionIds: [],
    },
  },
  {
    kind: "assistant" as const,
    value: {
      id: "assistant-2",
      requestId: "request-2",
      taskId: null,
      route: "assistant",
      message: "Second answer",
    },
  },
];

const turns: AuthoringTurn[] = [
  {
    requestId: "request-1",
    messageId: "request-1-assistant",
    status: "completed",
    taskIds: [],
    firstSequence: 1,
    updatedSequence: 2,
    parts: [
      {
        requestId: "request-1",
        messageId: "request-1-assistant",
        partId: "request-1-text",
        partKind: "text",
        status: "completed",
        firstSequence: 2,
        updatedSequence: 2,
        text: "First answer",
        tool: null,
        artifact: null,
      },
    ],
  },
  {
    requestId: "request-2",
    messageId: "request-2-assistant",
    status: "completed",
    taskIds: [],
    firstSequence: 3,
    updatedSequence: 4,
    parts: [
      {
        requestId: "request-2",
        messageId: "request-2-assistant",
        partId: "request-2-text",
        partKind: "text",
        status: "completed",
        firstSequence: 4,
        updatedSequence: 4,
        text: "Second answer",
        tool: null,
        artifact: null,
      },
    ],
  },
];

describe("authoring chat transcript", () => {
  it("keeps each assistant response beside its owning request", () => {
    expect(durableMessages(conversation, turns).map((message) => message.id)).toEqual([
      "authoring-request-request-1",
      "request-1-assistant",
      "authoring-request-request-2",
      "request-2-assistant",
    ]);
  });

  it("reconciles an acknowledged command with its durable request without duplicating the user turn", () => {
    const optimistic = {
      id: "command-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Create it" }],
      metadata: { commandId: "command-1" },
    };
    const durable = durableMessages(
      [
        {
          kind: "request",
          value: {
            id: "record-1",
            requestId: "request-1",
            instruction: "Create it",
            createdAt: "2026-09-17",
            sourceVersionIds: [],
          },
        },
      ],
      [
        {
          ...turns[0],
          parts: [],
        },
      ],
    );

    const merged = mergeDurableMessages(
      [optimistic],
      durable,
      new Map([["command-1", "request-1"]]),
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: "command-1", metadata: { requestId: "request-1" } });
  });

  it("reconciles a durable request that arrived before its command receipt", async () => {
    let resolveCommand: ((value: { requestId: string }) => void) | undefined;
    let durableConversation: ConversationMessageView[] = [];
    let durableTurns: AuthoringTurn[] = [];
    const listeners = new Set<(event: AuthoringEvent) => void>();
    const command = vi.fn(
      () =>
        new Promise<{ requestId: string }>((resolve) => {
          resolveCommand = resolve;
        }),
    );
    const request: AuthoringRequest = {
      instruction: "Create a chapter",
      reasoningEffort: "medium",
      targets: [],
      sourcePolicy: {
        sourceVersionIds: [],
        webEnabled: false,
        generalKnowledgeEnabled: false,
        researchDepth: "standard",
        requiredSectionIds: [],
        excludedSectionIds: [],
      },
    };
    const { result, rerender } = renderHook(() =>
      useCourseAuthoringChat({
        chatId: "session-1",
        conversation: durableConversation,
        turns: durableTurns,
        sendCommand: command,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSession: () => ({
          schemaVersion: 1,
          sessionId: "session-1",
          courseId: "course-1",
          language: "en",
          status: "active",
          snapshotSequence: 1,
          workspaceRevision: 1,
          records: [],
          tasks: [],
          turns: [],
        }),
      }),
    );

    let sendPromise: Promise<void> | undefined;
    act(() => {
      sendPromise = result.current.sendRequest(request);
    });
    expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(result.current.awaitingRequestReceipt).toBe(true);
    const commandId = result.current.messages[0]?.metadata?.commandId;
    expect(commandId).toBeTruthy();

    durableConversation = [
      {
        kind: "request",
        value: {
          id: "record-1",
          requestId: "request-1",
          instruction: request.instruction,
          createdAt: "2026-09-17T10:00:00.000Z",
          sourceVersionIds: [],
        },
      },
    ];
    durableTurns = [
      {
        requestId: "request-1",
        messageId: "durable-assistant-message",
        status: "running",
        taskIds: [],
        firstSequence: 1,
        updatedSequence: 1,
        parts: [],
      },
    ];
    rerender();
    expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      id: commandId,
      metadata: { commandId },
    });
    expect(result.current.awaitingRequestReceipt).toBe(true);

    act(() =>
      listeners.forEach((listener) =>
        listener({
          schemaVersion: 1,
          eventId: "command-accepted",
          sessionId: "session-1",
          sequence: 1,
          occurredAt: "2026-09-17T10:00:00.000Z",
          type: "command.accepted",
          payload: { commandId, action: "request.create", requestId: "request-1" },
        }),
      ),
    );
    expect(result.current.awaitingRequestReceipt).toBe(false);
    expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      id: commandId,
      metadata: { requestId: "request-1" },
    });

    await act(async () => {
      resolveCommand?.({ requestId: "request-1" });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(1);
      expect(result.current.messages[0]?.metadata).toMatchObject({
        commandId: expect.any(String),
        requestId: "request-1",
      });
      expect(result.current.status).toBe("streaming");
    });

    act(() =>
      listeners.forEach((listener) =>
        listener({
          schemaVersion: 1,
          eventId: "event-terminal",
          sessionId: "session-1",
          sequence: 2,
          occurredAt: "2026-09-17T10:00:01.000Z",
          type: "assistant.update",
          payload: {
            turn: {
              requestId: "request-1",
              messageId: "durable-assistant-message",
              status: "completed",
              taskIds: [],
              firstSequence: 1,
              updatedSequence: 2,
              part: null,
            },
          },
        }),
      ),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(sendPromise).toBeDefined();
    await sendPromise;
  });

  it("collapses a fallback stream message into its durable assistant turn by request identity", () => {
    const marker = (
      partId: string,
      updatedSequence: number,
      text: string,
    ): AuthoringChatMessage["parts"][number] => ({
      type: "data-authoringPart",
      id: partId,
      data: {
        requestId: "request-1",
        messageId: "durable-assistant-message",
        taskId: null,
        partId,
        partKind: "text",
        status: "completed",
        firstSequence: updatedSequence,
        updatedSequence,
        text,
        tool: null,
        artifact: null,
      },
    });
    const durableUser: AuthoringChatMessage = {
      id: "authoring-request-request-1",
      role: "user",
      parts: [{ type: "text", text: "Create a chapter" }],
      metadata: { requestId: "request-1", firstSequence: 1 },
    };
    const streamingAssistant: AuthoringChatMessage = {
      id: "request-1-assistant",
      role: "assistant",
      parts: [marker("part-1", 3, "The streamed answer.")],
      metadata: { requestId: "request-1", turnStatus: "running", updatedSequence: 3 },
    };
    const durableAssistant: AuthoringChatMessage = {
      id: "durable-assistant-message",
      role: "assistant",
      parts: [marker("part-1", 2, "The stored answer.")],
      metadata: { requestId: "request-1", turnStatus: "running", updatedSequence: 2 },
    };
    const durable = [durableUser, durableAssistant];

    const streaming = mergeDurableMessages([durableUser, streamingAssistant], durable, new Map());
    expect(streaming.filter((message) => message.role === "assistant")).toHaveLength(1);
    expect(streaming.at(-1)).toMatchObject({
      id: "request-1-assistant",
      metadata: { requestId: "request-1", updatedSequence: 3 },
    });

    const completed = mergeDurableMessages(streaming, durable, new Map());
    expect(completed.filter((message) => message.role === "assistant")).toHaveLength(1);
    expect(completed.at(-1)).toMatchObject({
      id: "request-1-assistant",
      metadata: { updatedSequence: 3 },
    });

    const reconciled = mergeDurableMessages(
      completed,
      [
        durableUser,
        {
          ...durableAssistant,
          parts: [marker("part-1", 3, "The streamed answer.")],
          metadata: { ...durableAssistant.metadata, updatedSequence: 3, turnStatus: "completed" },
        },
      ],
      new Map(),
    );
    expect(reconciled.filter((message) => message.role === "assistant")).toHaveLength(1);
    expect(reconciled.at(-1)).toMatchObject({
      id: "request-1-assistant",
      metadata: { updatedSequence: 3, turnStatus: "completed" },
    });
  });

  it("recovers durable assistant parts when the SDK leaves an empty terminal placeholder", () => {
    const emptySdkAssistant: AuthoringChatMessage = {
      id: "request-1-assistant",
      role: "assistant",
      parts: [],
      metadata: { requestId: "request-1", turnStatus: "completed", updatedSequence: 4 },
    };
    const durableAssistant: AuthoringChatMessage = {
      id: "durable-assistant-message",
      role: "assistant",
      parts: [
        {
          type: "data-authoringPart",
          id: "part-1",
          data: {
            requestId: "request-1",
            messageId: "durable-assistant-message",
            taskId: null,
            partId: "part-1",
            partKind: "text",
            status: "completed",
            firstSequence: 2,
            updatedSequence: 3,
            text: "The completed lesson is ready.",
            tool: null,
            artifact: null,
          },
        },
      ],
      metadata: { requestId: "request-1", turnStatus: "completed", updatedSequence: 3 },
    };

    const merged = mergeDurableMessages([emptySdkAssistant], [durableAssistant], new Map());

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "request-1-assistant",
      parts: [{ data: { text: "The completed lesson is ready." } }],
    });
  });

  it("retains an earlier assistant update when a later snapshot adds work", () => {
    const marker = (partId: string, sequence: number, text: string) => ({
      type: "data-authoringPart" as const,
      id: partId,
      data: {
        requestId: "request-1",
        messageId: "request-1-assistant",
        taskId: null,
        partId,
        partKind: "text" as const,
        status: "completed" as const,
        firstSequence: sequence,
        updatedSequence: sequence,
        text,
        tool: null,
        artifact: null,
      },
    });
    const live: AuthoringChatMessage = {
      id: "request-1-assistant",
      role: "assistant",
      parts: [
        marker("initial-plan", 2, "I’ll draft the lesson."),
        marker("research", 3, "Searching sources"),
      ],
      metadata: { requestId: "request-1", updatedSequence: 3 },
    };
    const saved: AuthoringChatMessage = {
      id: "saved-assistant",
      role: "assistant",
      parts: [marker("final", 5, "I need more evidence.")],
      metadata: { requestId: "request-1", updatedSequence: 5 },
    };

    const merged = mergeDurableMessages([live], [saved], new Map());
    expect(merged).toHaveLength(1);
    expect(merged[0].parts.filter((part) => part.type === "data-authoringPart")).toHaveLength(3);
  });

  it("shows the optimistic turn before the command receipt and streams the acknowledged response", async () => {
    let resolveCommand: ((value: { requestId: string }) => void) | undefined;
    let session: AuthoringSession = {
      schemaVersion: 1,
      sessionId: "session-1",
      courseId: "course-1",
      language: "en",
      status: "active",
      snapshotSequence: 1,
      workspaceRevision: 1,
      records: [],
      tasks: [],
      turns: [],
    };
    const listeners = new Set<(event: AuthoringEvent) => void>();
    const command = vi.fn(
      () =>
        new Promise<{ requestId: string }>((resolve) => {
          resolveCommand = resolve;
        }),
    );
    const request: AuthoringRequest = {
      instruction: "Create a lesson",
      reasoningEffort: "medium",
      targets: [],
      sourcePolicy: {
        sourceVersionIds: ["selected-for-context"],
        webEnabled: false,
        generalKnowledgeEnabled: false,
        researchDepth: "standard",
        requiredSectionIds: [],
        excludedSectionIds: [],
      },
      attachedSourceVersionIds: ["attached-to-this-request"],
    };
    const { result } = renderHook(() =>
      useCourseAuthoringChat({
        chatId: "session-1",
        conversation: [],
        sendCommand: command,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSession: () => session,
      }),
    );

    let sendPromise: Promise<void> | undefined;
    act(() => {
      sendPromise = result.current.sendRequest(request);
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      metadata: { sourceVersionIds: ["attached-to-this-request"] },
    });
    expect(command).toHaveBeenCalledTimes(1);

    await act(async () => {
      session = {
        ...session,
        tasks: [
          {
            taskId: "task-1",
            requestId: "request-1",
            kind: "lesson",
            status: "running",
            errorCode: null,
            outputId: null,
          },
        ],
        turns: [
          {
            requestId: "request-1",
            messageId: "request-1-assistant",
            status: "running",
            taskIds: ["task-1"],
            firstSequence: 1,
            updatedSequence: 2,
            parts: [],
          },
        ],
      };
      resolveCommand?.({ requestId: "request-1" });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe("streaming"));
    act(() => {
      listeners.forEach((listener) =>
        listener({
          schemaVersion: 1,
          eventId: "event-delta",
          sessionId: "session-1",
          sequence: 2,
          occurredAt: "2026-09-17T10:00:00.000Z",
          type: "assistant.delta",
          payload: {
            turn: {
              requestId: "request-1",
              messageId: "request-1-assistant",
              status: "running",
              taskIds: ["task-1"],
              firstSequence: 1,
              updatedSequence: 2,
              part: {
                requestId: "request-1",
                messageId: "request-1-assistant",
                partId: "part-1",
                partKind: "text",
                taskId: "task-1",
                status: "completed",
                firstSequence: 2,
                updatedSequence: 2,
                text: "Lesson response",
                tool: null,
                artifact: null,
              },
            },
          },
        }),
      );
      session = {
        ...session,
        tasks: session.tasks.map((task) => ({ ...task, status: "succeeded" })),
        turns: session.turns?.map((turn) => ({ ...turn, status: "completed" })),
      };
      listeners.forEach((listener) =>
        listener({
          schemaVersion: 1,
          eventId: "event-done",
          sessionId: "session-1",
          sequence: 3,
          occurredAt: "2026-09-17T10:00:01.000Z",
          type: "task.succeeded",
          payload: {
            turn: {
              requestId: "request-1",
              messageId: "request-1-assistant",
              status: "completed",
              taskIds: ["task-1"],
              firstSequence: 1,
              updatedSequence: 3,
              part: {
                requestId: "request-1",
                messageId: "request-1-assistant",
                partId: "part-1",
                partKind: "text",
                taskId: "task-1",
                status: "completed",
                firstSequence: 2,
                updatedSequence: 3,
                text: "Lesson response",
                tool: null,
                artifact: null,
              },
            },
          },
        }),
      );
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(sendPromise).toBeDefined();
    await sendPromise;
  });

  it("clears a stale SDK stream when a terminal snapshot arrives without a terminal event", async () => {
    let resolveCommand: ((value: { requestId: string }) => void) | undefined;
    let turns: AuthoringTurn[] = [];
    const listeners = new Set<(event: AuthoringEvent) => void>();
    const command = vi.fn(
      () =>
        new Promise<{ requestId: string }>((resolve) => {
          resolveCommand = resolve;
        }),
    );
    const session: AuthoringSession = {
      schemaVersion: 1,
      sessionId: "session-1",
      courseId: "course-1",
      language: "en",
      status: "active",
      snapshotSequence: 1,
      workspaceRevision: 1,
      records: [],
      tasks: [],
      turns,
    };
    const conversation: ConversationMessageView[] = [
      {
        kind: "request",
        value: {
          id: "record-1",
          requestId: "request-1",
          instruction: "Create a lesson",
          createdAt: "2026-09-17",
          sourceVersionIds: [],
        },
      },
    ];
    const request: AuthoringRequest = {
      instruction: "Create a lesson",
      reasoningEffort: "medium",
      targets: [],
      sourcePolicy: {
        sourceVersionIds: [],
        webEnabled: false,
        generalKnowledgeEnabled: false,
        researchDepth: "standard",
        requiredSectionIds: [],
        excludedSectionIds: [],
      },
    };
    const { result, rerender } = renderHook(() =>
      useCourseAuthoringChat({
        chatId: "session-1",
        conversation,
        turns,
        sendCommand: command,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSession: () => ({ ...session, turns }),
      }),
    );

    let sendPromise: Promise<void> | undefined;
    act(() => {
      sendPromise = result.current.sendRequest(request);
    });
    await act(async () => {
      resolveCommand?.({ requestId: "request-1" });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.messages[0]?.metadata?.requestId).toBe("request-1"));

    turns = [
      {
        requestId: "request-1",
        messageId: "request-1-assistant",
        status: "completed",
        taskIds: [],
        firstSequence: 1,
        updatedSequence: 3,
        parts: [
          {
            requestId: "request-1",
            messageId: "request-1-assistant",
            partId: "part-1",
            partKind: "text",
            status: "completed",
            firstSequence: 2,
            updatedSequence: 3,
            text: "The completed lesson is ready.",
            tool: null,
            artifact: null,
          },
        ],
      },
    ];
    rerender();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(result.current.messages.filter((message) => message.role === "assistant")).toHaveLength(
      1,
    );
    expect(result.current.messages.at(-1)?.parts[0]).toMatchObject({
      data: { text: "The completed lesson is ready." },
    });
    expect(sendPromise).toBeDefined();
    await sendPromise;
  });

  it("replays the real delta, message, and task success sequence when the receipt lags", async () => {
    let resolveCommand: ((value: { requestId: string }) => void) | undefined;
    const routeRequestId = "2932f0a8-5025-4a75-af15-00274176b83d";
    const routeTaskId = "a6d87eee-75fe-4b64-af5b-26e003131e23";
    const routeMessageId = `${routeRequestId}-assistant`;
    const listeners = new Set<(event: AuthoringEvent) => void>();
    const command = vi.fn(
      () =>
        new Promise<{ requestId: string }>((resolve) => {
          resolveCommand = resolve;
        }),
    );
    const initialSession: AuthoringSession = {
      schemaVersion: 1,
      sessionId: "session-1",
      courseId: "course-1",
      language: "en",
      status: "active",
      snapshotSequence: 181,
      workspaceRevision: 1,
      records: [],
      tasks: [],
      turns: [],
    };
    const request: AuthoringRequest = {
      instruction: "Hello",
      reasoningEffort: "medium",
      targets: [],
      sourcePolicy: {
        sourceVersionIds: [],
        webEnabled: false,
        generalKnowledgeEnabled: false,
        researchDepth: "standard",
        requiredSectionIds: [],
        excludedSectionIds: [],
      },
    };
    const { result } = renderHook(() =>
      useCourseAuthoringChat({
        chatId: "session-1",
        conversation: [],
        turns: initialSession.turns,
        sendCommand: command,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSession: () => initialSession,
      }),
    );

    let sendPromise: Promise<void> | undefined;
    act(() => {
      sendPromise = result.current.sendRequest(request);
    });
    const turn = (sequence: number, status: "running" | "completed", part: unknown) => ({
      requestId: routeRequestId,
      messageId: routeMessageId,
      status,
      taskIds: [routeTaskId],
      firstSequence: 178,
      updatedSequence: sequence,
      part,
    });
    const part = (sequence: number, status: "streaming" | "completed", text: string) => ({
      requestId: routeRequestId,
      messageId: routeMessageId,
      partId: `assistant:${routeTaskId}:route`,
      partKind: "text",
      taskId: routeTaskId,
      status,
      firstSequence: 182,
      updatedSequence: sequence,
      text,
      tool: null,
      artifact: null,
    });
    const emit = (sequence: number, status: "running" | "completed", turnPart: unknown) =>
      listeners.forEach((listener) =>
        listener({
          schemaVersion: 1,
          eventId: `event-${sequence}`,
          sessionId: "session-1",
          sequence,
          occurredAt: "2026-09-21T10:00:00.000Z",
          type: "assistant.message",
          payload: { turn: turn(sequence, status, turnPart) },
        }),
      );

    act(() => emit(182, "running", part(182, "streaming", "Hi!")));
    act(() => emit(183, "running", part(183, "completed", "Hi!")));
    act(() => emit(184, "completed", null));
    await act(async () => {
      resolveCommand?.({ requestId: routeRequestId });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.messages.at(-1)?.role).toBe("assistant");
    expect(sendPromise).toBeDefined();
    await sendPromise;
  });
});
