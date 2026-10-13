import { describe, expect, it } from "vitest";

import {
  activeChatRequestId,
  activeAssistantRequestIds,
  authoringMessagesFromTurns,
  canonicalAuthoringTurns,
  messageSequence,
  projectAuthoringTimeline,
} from "./authoringConversation";
import { projectWorkspaceRecords } from "./courseAuthoring.records";

import type { AuthoringChatMessage } from "./authoringChatTransport";
import type { AuthoringTurn, ConversationMessageView } from "./courseAuthoring.types";

type AuthoringPart = Extract<AuthoringChatMessage["parts"][number], { type: "data-authoringPart" }>;

const authoringParts = (message: AuthoringChatMessage | undefined): AuthoringPart[] =>
  message?.parts.filter((part): part is AuthoringPart => part.type === "data-authoringPart") ?? [];

const request = (requestId: string, instruction: string): ConversationMessageView => ({
  kind: "request",
  value: {
    id: `record-${requestId}`,
    requestId,
    instruction,
    createdAt: "2026-09-18T10:00:00.000Z",
    sourceVersionIds: [],
  },
});

const turns: AuthoringTurn[] = [
  {
    requestId: "request-a",
    messageId: "message-a",
    status: "completed",
    taskIds: ["task-a"],
    firstSequence: 10,
    updatedSequence: 40,
    parts: [
      {
        requestId: "request-a",
        messageId: "message-a",
        partId: "text-a-1",
        partKind: "text",
        status: "completed",
        firstSequence: 11,
        updatedSequence: 11,
        text: "I will check the sources first.",
        tool: null,
        artifact: null,
      },
      {
        requestId: "request-a",
        messageId: "message-a",
        partId: "tool-a",
        partKind: "tool",
        taskId: "task-a",
        status: "completed",
        firstSequence: 20,
        updatedSequence: 30,
        text: null,
        tool: {
          toolCallId: "tool-call-a",
          toolName: "web_search",
          display: "Searching sources",
          status: "completed",
          result: { sourceCount: 3 },
        },
        artifact: null,
      },
      {
        requestId: "request-a",
        messageId: "message-a",
        partId: "text-a-2",
        partKind: "text",
        status: "completed",
        firstSequence: 35,
        updatedSequence: 40,
        text: "Here is what I found.",
        tool: null,
        artifact: null,
      },
    ],
  },
  {
    requestId: "request-b",
    messageId: "message-b",
    status: "running",
    taskIds: ["task-b"],
    firstSequence: 50,
    updatedSequence: 60,
    parts: [
      {
        requestId: "request-b",
        messageId: "message-b",
        partId: "text-b",
        partKind: "text",
        status: "streaming",
        firstSequence: 51,
        updatedSequence: 60,
        text: "Preparing the lesson.",
        tool: null,
        artifact: null,
      },
    ],
  },
];

describe("authoring conversation projection", () => {
  it("keeps the active response indicator below earlier assistant work", () => {
    const messages = authoringMessagesFromTurns(
      canonicalAuthoringTurns(turns, [
        request("request-a", "Research"),
        request("request-b", "Write"),
      ]),
    );
    const timeline = projectAuthoringTimeline(messages, [
      { id: "pending-task-b", requestId: "request-b", kind: "pending", value: "Preparing" },
    ]);

    expect(timeline.at(-1)?.id).toBe("pending-task-b");
  });

  it("keeps a submitted or streaming request attached to its current owner", () => {
    const optimistic: AuthoringChatMessage = {
      id: "command-1",
      role: "user",
      parts: [{ type: "text", text: "Create a chapter" }],
      metadata: { commandId: "command-1" },
    };
    const acknowledged = {
      ...optimistic,
      metadata: { ...optimistic.metadata, requestId: "request-1" },
    };

    expect(activeChatRequestId([optimistic], "submitted")).toBe("command-1");
    expect(activeChatRequestId([acknowledged], "streaming")).toBe("request-1");
    expect(activeChatRequestId([acknowledged], "ready")).toBeNull();
  });

  it("lets a newer terminal chat update clear a stale active-turn placeholder", () => {
    const runningTurn: AuthoringTurn = {
      ...turns[0],
      status: "running",
      updatedSequence: 40,
    };
    const requestMessage = request("request-a", "Search");
    const terminalAssistant: AuthoringChatMessage = {
      id: "message-a-stream",
      role: "assistant",
      parts: [],
      metadata: {
        requestId: "request-a",
        turnStatus: "completed",
        updatedSequence: 40,
      },
    };

    expect(activeAssistantRequestIds([runningTurn], [requestMessage], [terminalAssistant])).toEqual(
      new Set(),
    );
    expect(
      activeAssistantRequestIds(
        [{ ...runningTurn, updatedSequence: 41 }],
        [requestMessage],
        [terminalAssistant],
      ),
    ).toEqual(new Set(["request-a"]));
  });

  it("anchors a multi-proposal group after its latest proposal marker", () => {
    const user: AuthoringChatMessage = {
      id: "request-a",
      role: "user",
      parts: [{ type: "text", text: "Create chapters" }],
      metadata: { requestId: "request-a", firstSequence: 1 },
    };
    const assistant: AuthoringChatMessage = {
      id: "message-a",
      role: "assistant",
      metadata: { requestId: "request-a", firstSequence: 1 },
      parts: [
        {
          type: "data-authoringPart",
          id: "proposal-part-1",
          data: {
            requestId: "request-a",
            messageId: "message-a",
            taskId: "task-a",
            partId: "proposal-part-1",
            partKind: "proposal",
            status: "review",
            firstSequence: 2,
            updatedSequence: 2,
            text: null,
            tool: null,
            artifact: { artifactKind: "proposal", artifactId: "proposal-1" },
          },
        },
        {
          type: "data-authoringPart",
          id: "intervening-text",
          data: {
            requestId: "request-a",
            messageId: "message-a",
            taskId: "task-a",
            partId: "intervening-text",
            partKind: "text",
            status: "completed",
            firstSequence: 3,
            updatedSequence: 3,
            text: "Another update arrived.",
            tool: null,
            artifact: null,
          },
        },
        {
          type: "data-authoringPart",
          id: "proposal-part-2",
          data: {
            requestId: "request-a",
            messageId: "message-a",
            taskId: "task-a",
            partId: "proposal-part-2",
            partKind: "proposal",
            status: "review",
            firstSequence: 4,
            updatedSequence: 4,
            text: null,
            tool: null,
            artifact: { artifactKind: "proposal", artifactId: "proposal-2" },
          },
        },
      ],
    };
    const timeline = projectAuthoringTimeline(
      [user, assistant],
      [
        {
          id: "proposal-group-task-a",
          requestId: "request-a",
          kind: "proposalGroup",
          taskId: "task-a",
          artifactIds: ["proposal-1", "proposal-2"],
          value: "group",
        },
      ],
    );

    expect(timeline.map((item) => item.id)).toEqual([
      "request-a",
      "proposal-part-1",
      "intervening-text",
      "proposal-part-2",
      "proposal-group-task-a",
    ]);
  });

  it("keeps one request projection and one decoration per owner while preserving distinct tasks", () => {
    const userMessages: AuthoringChatMessage[] = [
      {
        id: "optimistic-request",
        role: "user",
        parts: [{ type: "text", text: "Write two lessons" }],
        metadata: { requestId: "request-a", commandId: "command-a", firstSequence: 1 },
      },
      {
        id: "durable-request",
        role: "user",
        parts: [{ type: "text", text: "Write two lessons" }],
        metadata: { requestId: "request-a", firstSequence: 1 },
      },
    ];
    const assistantMessages: AuthoringChatMessage[] = [
      {
        id: "stream-message",
        role: "assistant",
        metadata: { requestId: "request-a" },
        parts: [
          {
            type: "data-authoringPart",
            id: "stream-tool-marker",
            data: {
              requestId: "request-a",
              messageId: "stream-message",
              taskId: "task-a",
              partId: "stream-tool-marker",
              partKind: "tool",
              status: "streaming",
              firstSequence: 2,
              updatedSequence: 3,
              text: null,
              tool: {
                toolCallId: "tool-call-a",
                toolName: "web_search",
                display: "Searching sources",
                status: "started",
                result: null,
              },
              artifact: null,
            },
          },
          {
            type: "data-authoringPart",
            id: "stream-proposal-marker",
            data: {
              requestId: "request-a",
              messageId: "stream-message",
              taskId: "task-a",
              partId: "stream-proposal-marker",
              partKind: "proposal",
              status: "review",
              firstSequence: 4,
              updatedSequence: 4,
              text: null,
              tool: null,
              artifact: { artifactKind: "proposal", artifactId: "proposal-a" },
            },
          },
        ],
      },
      {
        id: "durable-message",
        role: "assistant",
        metadata: { requestId: "request-a" },
        parts: [
          {
            type: "data-authoringPart",
            id: "durable-tool-marker",
            data: {
              requestId: "request-a",
              messageId: "durable-message",
              taskId: "task-a",
              partId: "durable-tool-marker",
              partKind: "tool",
              status: "completed",
              firstSequence: 2,
              updatedSequence: 5,
              text: null,
              tool: {
                toolCallId: "tool-call-a",
                toolName: "web_search",
                display: "Searching sources",
                status: "completed",
                result: null,
              },
              artifact: null,
            },
          },
          {
            type: "data-authoringPart",
            id: "durable-proposal-marker",
            data: {
              requestId: "request-a",
              messageId: "durable-message",
              taskId: "task-a",
              partId: "durable-proposal-marker",
              partKind: "proposal",
              status: "review",
              firstSequence: 4,
              updatedSequence: 6,
              text: null,
              tool: null,
              artifact: { artifactKind: "proposal", artifactId: "proposal-a" },
            },
          },
          {
            type: "data-authoringPart",
            id: "second-task-tool-marker",
            data: {
              requestId: "request-a",
              messageId: "durable-message",
              taskId: "task-b",
              partId: "second-task-tool-marker",
              partKind: "tool",
              status: "streaming",
              firstSequence: 7,
              updatedSequence: 7,
              text: null,
              tool: {
                toolCallId: "tool-call-b",
                toolName: "web_search",
                display: "Searching sources",
                status: "started",
                result: null,
              },
              artifact: null,
            },
          },
        ],
      },
    ];
    const timeline = projectAuthoringTimeline(
      [...userMessages, ...assistantMessages],
      [
        { id: "pending-a", requestId: "request-a", kind: "pending", value: "pending" },
        { id: "pending-b", requestId: "request-a", kind: "pending", value: "duplicate pending" },
        {
          id: "activity-a",
          requestId: "request-a",
          kind: "activity",
          taskId: "task-a",
          value: "task a",
        },
        {
          id: "activity-a-duplicate",
          requestId: "request-a",
          kind: "activity",
          taskId: "task-a",
          value: "duplicate task a",
        },
        {
          id: "activity-b",
          requestId: "request-a",
          kind: "activity",
          taskId: "task-b",
          value: "task b",
        },
      ],
    );

    expect(timeline.filter((item) => item.kind === "request")).toHaveLength(1);
    expect(
      timeline.filter((item) => item.kind === "part" && item.part.data.partKind === "proposal"),
    ).toHaveLength(1);
    expect(
      timeline.filter((item) => item.kind === "part" && item.part.data.partKind === "tool"),
    ).toHaveLength(2);
    expect(timeline.filter((item) => item.kind === "pending")).toHaveLength(1);
    expect(timeline.filter((item) => item.kind === "activity")).toHaveLength(2);
  });

  it("does not treat source-only session turns as assistant response work", () => {
    const sourceProcessingTurn: AuthoringTurn = {
      requestId: "source-ingestion-task",
      messageId: "source-ingestion-message",
      status: "running",
      taskIds: ["source-ingestion-task"],
      parts: [],
      firstSequence: 2,
      updatedSequence: 2,
    };

    const acceptedSource = projectWorkspaceRecords([
      {
        id: "source-record-1",
        kind: "source",
        payload: {
          sourceVersionId: "source-ingestion-task",
          taskId: "source-ingestion-task",
          filename: "course-guide.pdf",
          status: "queued",
        },
      },
    ]);

    expect(acceptedSource.sources[0]).toMatchObject({
      id: "source-ingestion-task",
      name: "course-guide.pdf",
      status: "queued",
    });
    expect(activeAssistantRequestIds([sourceProcessingTurn], acceptedSource.conversation)).toEqual(
      new Set(),
    );
    expect(activeAssistantRequestIds([sourceProcessingTurn], [])).toEqual(new Set());
    expect(
      activeAssistantRequestIds([sourceProcessingTurn], [request("source-ingestion-task", "")]),
    ).toEqual(new Set(["source-ingestion-task"]));
  });

  it("keeps turn order and text/tool/text part order from the server sequences", () => {
    const projected = canonicalAuthoringTurns([...turns].reverse(), [
      request("request-a", "Search"),
      request("request-b", "Write"),
    ]);
    const messages = authoringMessagesFromTurns(projected);

    expect(messages.map((message) => message.id)).toEqual([
      "authoring-request-request-a",
      "message-a",
      "authoring-request-request-b",
      "message-b",
    ]);
    expect(messages[0]?.metadata?.firstSequence).toBe(10);
    expect(messages[1]?.metadata?.firstSequence).toBe(10);
    expect(messages[2]?.metadata?.firstSequence).toBe(50);
    expect(messages[1]?.parts.map((part) => part.type)).toEqual([
      "data-authoringPart",
      "data-authoringPart",
      "data-authoringPart",
    ]);
    expect(authoringParts(messages[1]).map((part) => part.data.partKind)).toEqual([
      "text",
      "tool",
      "text",
    ]);
    expect(
      authoringParts(messages[1]).flatMap((part) => (part.data.text ? [part.data.text] : [])),
    ).toEqual(["I will check the sources first.", "Here is what I found."]);
  });

  it("uses the newer sequence for a part even when the final text is shorter", () => {
    const revisedTurns: AuthoringTurn[] = [
      {
        ...turns[0],
        parts: [
          ...turns[0].parts,
          {
            ...turns[0].parts[2],
            text: "Done.",
            updatedSequence: 70,
          },
        ],
        updatedSequence: 70,
      },
    ];
    const projected = canonicalAuthoringTurns(revisedTurns, [request("request-a", "Search")]);
    const assistant = authoringMessagesFromTurns(projected)[1];

    expect(assistant && messageSequence(assistant)).toBe(70);
    expect(authoringParts(assistant).at(-1)).toMatchObject({ data: { text: "Done." } });
  });

  it("does not recreate a transcript from legacy records when turns are absent", () => {
    expect(canonicalAuthoringTurns(undefined, [request("request-a", "Search")])).toEqual([]);
  });
});
