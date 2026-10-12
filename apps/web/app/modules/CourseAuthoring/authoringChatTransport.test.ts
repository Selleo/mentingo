import { describe, expect, it, vi } from "vitest";

import { createAuthoringChatTransport } from "./authoringChatTransport";

import type { AuthoringEvent, AuthoringSession } from "./courseAuthoring.types";

const requestId = "request-1";
const taskId = "task-1";
const messageId = `${requestId}-assistant`;

const baseSession = (status: "running" | "succeeded"): AuthoringSession => ({
  schemaVersion: 1,
  sessionId: "session-1",
  courseId: "course-1",
  language: "en",
  status: "active",
  snapshotSequence: 1,
  workspaceRevision: 1,
  records: [],
  tasks: [
    {
      taskId,
      requestId,
      kind: "lesson",
      status,
      errorCode: null,
      outputId: null,
    },
  ],
  turns: [
    {
      requestId,
      messageId,
      status: status === "succeeded" ? "completed" : "running",
      taskIds: [taskId],
      firstSequence: 1,
      updatedSequence: status === "succeeded" ? 4 : 1,
      parts: [],
    },
  ],
});

const turn = (
  status: "running" | "waiting_author" | "completed" | "failed" | "stopped",
  updatedSequence: number,
  part: Record<string, unknown> | null,
) => ({
  requestId,
  messageId,
  status,
  taskIds: [taskId],
  firstSequence: 1,
  updatedSequence,
  part,
});

const part = (overrides: Record<string, unknown>) => ({
  requestId,
  messageId,
  partId: "text-1",
  partKind: "text",
  taskId,
  status: "streaming",
  firstSequence: 2,
  updatedSequence: 2,
  text: null,
  tool: null,
  artifact: null,
  ...overrides,
});

const event = (sequence: number, payloadTurn: Record<string, unknown>): AuthoringEvent => ({
  schemaVersion: 1,
  eventId: `event-${sequence}`,
  sessionId: "session-1",
  sequence,
  occurredAt: "2026-09-17T10:00:00.000Z",
  type: "assistant.update",
  payload: { turn: payloadTurn },
});

const requestOptions = {
  trigger: "submit-message" as const,
  chatId: "session-1",
  messageId: undefined,
  messages: [
    {
      id: "user-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Create a lesson" }],
    },
  ],
  body: {
    commandId: "command-1",
    request: {
      instruction: "Create a lesson",
      reasoningEffort: "medium" as const,
      targets: [],
      sourcePolicy: {
        sourceVersionIds: [],
        webEnabled: false,
        generalKnowledgeEnabled: false,
        researchDepth: "standard" as const,
        requiredSectionIds: [],
        excludedSectionIds: [],
      },
    },
  },
  abortSignal: undefined,
};

const readChunks = async (stream: ReadableStream) => {
  const reader = stream.getReader();
  const chunks: unknown[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) return chunks;
    chunks.push(next.value);
  }
};

const setup = (session = baseSession("running")) => {
  const listeners = new Set<(event: AuthoringEvent) => void>();
  const snapshotListeners = new Set<() => void>();
  const sendCommand = vi.fn().mockResolvedValue({ requestId });
  const transport = createAuthoringChatTransport({
    sendCommand,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeSnapshot: (listener) => {
      snapshotListeners.add(listener);
      return () => snapshotListeners.delete(listener);
    },
    getSession: () => session,
  });
  return { listeners, sendCommand, session, snapshotListeners, transport };
};

describe("createAuthoringChatTransport", () => {
  it("streams canonical text, tool findings, and proposal parts in durable order", async () => {
    const test = setup();
    const stream = await test.transport.sendMessages(requestOptions);
    const chunksPromise = readChunks(stream);

    test.listeners.forEach((listener) =>
      listener(
        event(
          2,
          turn(
            "running",
            2,
            part({
              text: "I found ",
              planSteps: ["Research Mentingo", "Draft lessons"],
              phase: "preparing",
              updatedSequence: 2,
            }),
          ),
        ),
      ),
    );
    test.listeners.forEach((listener) =>
      listener(
        event(3, turn("running", 3, part({ text: "I found two sources.", updatedSequence: 3 }))),
      ),
    );
    test.listeners.forEach((listener) =>
      listener(
        event(
          4,
          turn("running", 4, {
            ...part({
              partId: "tool-1",
              partKind: "tool",
              status: "completed",
              firstSequence: 4,
              updatedSequence: 4,
              text: null,
              tool: {
                toolCallId: "tool-call-1",
                toolName: "web_search",
                display: "Checking sources",
                status: "completed",
                result: {
                  query: "Platform documentation",
                  sources: [{ url: "https://example.com/docs", title: "Docs" }],
                  sourceCount: 2,
                  findingCount: 1,
                },
              },
            }),
          }),
        ),
      ),
    );
    test.listeners.forEach((listener) =>
      listener(
        event(
          5,
          turn("completed", 5, {
            ...part({
              partId: "proposal-1",
              partKind: "proposal",
              status: "review",
              firstSequence: 5,
              updatedSequence: 5,
              text: null,
              artifact: { artifactKind: "proposal", artifactId: "proposal-1" },
            }),
          }),
        ),
      ),
    );

    const chunks = await chunksPromise;
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: "data-authoringPart",
        data: expect.objectContaining({ planSteps: ["Research Mentingo", "Draft lessons"] }),
      }),
    );
    const partChunks = chunks.filter(
      (chunk): chunk is { type: string; data: Record<string, unknown> } =>
        typeof chunk === "object" &&
        chunk !== null &&
        "type" in chunk &&
        chunk.type === "data-authoringPart",
    );
    expect(partChunks.map((chunk) => chunk.data.partId)).toEqual([
      "text-1",
      "text-1",
      "tool-1",
      "proposal-1",
    ]);
    expect(partChunks[0]?.data.phase).toBe("preparing");
    expect(chunks).toContainEqual({
      type: "data-authoringTool",
      id: "tool-1",
      data: {
        requestId,
        taskId,
        partId: "tool-1",
        toolCallId: "tool-call-1",
        toolName: "web_search",
        display: "Checking sources",
        status: "completed",
        result: {
          query: "Platform documentation",
          sources: [{ url: "https://example.com/docs", title: "Docs" }],
          sourceCount: 2,
          findingCount: 1,
        },
      },
    });
    expect(chunks).toContainEqual({
      type: "data-authoringProposal",
      id: "proposal-1",
      data: {
        requestId,
        taskId,
        partId: "proposal-1",
        proposalId: "proposal-1",
        revision: null,
      },
    });
    expect(chunks.at(-1)).toEqual({ type: "finish", finishReason: "stop" });
  });

  it("keeps the authoritative typed part when a final text is shorter and non-prefix", async () => {
    const test = setup();
    const stream = await test.transport.sendMessages(requestOptions);
    const chunksPromise = readChunks(stream);

    test.listeners.forEach((listener) =>
      listener(event(2, turn("running", 2, part({ text: "A longer draft", updatedSequence: 2 })))),
    );
    test.listeners.forEach((listener) =>
      listener(
        event(
          3,
          turn(
            "completed",
            3,
            part({ text: "Short final", status: "completed", updatedSequence: 3 }),
          ),
        ),
      ),
    );

    const chunks = await chunksPromise;
    expect(chunks).toContainEqual({ type: "text-delta", id: "text-1", delta: "A longer draft" });
    expect(chunks).not.toContainEqual({ type: "text-delta", id: "text-1", delta: "Short final" });
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: "data-authoringPart",
        data: expect.objectContaining({
          partId: "text-1",
          text: "Short final",
          updatedSequence: 3,
        }),
      }),
    );
  });

  it.each(["waiting_author", "completed", "failed", "stopped"] as const)(
    "closes on the typed %s turn lifecycle without task inference",
    async (status) => {
      const test = setup();
      const stream = await test.transport.sendMessages(requestOptions);
      const chunksPromise = readChunks(stream);
      test.listeners.forEach((listener) => listener(event(2, turn(status, 2, null))));

      const chunks = await chunksPromise;
      expect(chunks).toContainEqual({
        type: "message-metadata",
        messageMetadata: { requestId, turnStatus: status, updatedSequence: 2 },
      });
      expect(chunks.at(-1)).toEqual({
        type: "finish",
        finishReason: status === "failed" ? "error" : "stop",
      });
    },
  );

  it("closes from a terminal snapshot when the terminal event was skipped after refresh", async () => {
    const test = setup();
    const stream = await test.transport.sendMessages(requestOptions);
    const chunksPromise = readChunks(stream);

    test.listeners.forEach((listener) =>
      listener(event(2, turn("running", 2, part({ text: "Progress", updatedSequence: 2 })))),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const turns = test.session.turns;
    const currentTurn = turns?.[0];
    if (!currentTurn) throw new Error("test turn missing");
    turns[0] = {
      ...currentTurn,
      status: "completed",
      updatedSequence: 4,
    };
    test.snapshotListeners.forEach((listener) => listener());

    const chunks = await chunksPromise;

    test.listeners.forEach((listener) => listener(event(4, turn("completed", 4, null))));
    expect(chunks).toContainEqual({
      type: "message-metadata",
      messageMetadata: { requestId, turnStatus: "completed", updatedSequence: 4 },
    });
    expect(chunks.filter((chunk) => (chunk as { type?: string }).type === "finish")).toHaveLength(
      1,
    );
    expect(chunks.at(-1)).toEqual({ type: "finish", finishReason: "stop" });
  });

  it("ignores duplicate typed updates and does not infer reconnects from tasks", async () => {
    const test = setup();
    const stream = await test.transport.sendMessages(requestOptions);
    const chunksPromise = readChunks(stream);
    const toolTurn = turn("running", 2, {
      ...part({
        partId: "tool-1",
        partKind: "tool",
        status: "streaming",
        firstSequence: 2,
        updatedSequence: 2,
        text: null,
        tool: {
          toolCallId: "tool-call-1",
          toolName: "web_search",
          display: "Searching",
          status: "started",
          result: null,
        },
      }),
    });
    test.listeners.forEach((listener) => listener(event(2, toolTurn)));
    test.listeners.forEach((listener) => listener(event(2, toolTurn)));
    test.listeners.forEach((listener) => listener(event(3, turn("waiting_author", 3, null))));

    const chunks = await chunksPromise;
    expect(
      chunks.filter((chunk) => (chunk as { type?: string }).type === "data-authoringTool"),
    ).toHaveLength(1);
    await expect(
      test.transport.reconnectToStream?.({
        chatId: "session-1",
        body: {},
      }),
    ).resolves.toBeNull();
  });

  it("finishes the route turn after a completed message is followed by task success", async () => {
    const test = setup();
    const routeTaskId = "a6d87eee-75fe-4b64-af5b-26e003131e23";
    const routeRequestId = "2932f0a8-5025-4a75-af15-00274176b83d";
    test.sendCommand.mockResolvedValue({ requestId: routeRequestId });
    const stream = await test.transport.sendMessages(requestOptions);
    const chunksPromise = readChunks(stream);
    const routeMessageId = `${routeRequestId}-assistant`;
    const routePart = {
      requestId: routeRequestId,
      messageId: routeMessageId,
      partId: `assistant:${routeTaskId}:route`,
      partKind: "text",
      taskId: routeTaskId,
      status: "streaming",
      firstSequence: 182,
      updatedSequence: 182,
      text: "Hi!",
      tool: null,
      artifact: null,
    };
    const baseTurn = {
      requestId: routeRequestId,
      messageId: routeMessageId,
      taskIds: [routeTaskId],
      firstSequence: 178,
    };

    test.listeners.forEach((listener) =>
      listener(
        event(182, {
          ...baseTurn,
          status: "running",
          updatedSequence: 182,
          part: routePart,
        }),
      ),
    );
    test.listeners.forEach((listener) =>
      listener(
        event(183, {
          ...baseTurn,
          status: "running",
          updatedSequence: 183,
          part: { ...routePart, status: "completed", updatedSequence: 183 },
        }),
      ),
    );
    test.listeners.forEach((listener) =>
      listener(
        event(184, {
          ...baseTurn,
          status: "completed",
          updatedSequence: 184,
          part: null,
        }),
      ),
    );

    const chunks = await chunksPromise;
    expect(chunks.at(-1)).toEqual({ type: "finish", finishReason: "stop" });
    expect(chunks).toContainEqual({
      type: "message-metadata",
      messageMetadata: {
        requestId: routeRequestId,
        turnStatus: "completed",
        updatedSequence: 184,
      },
    });
  });
});
