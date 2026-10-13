import { describe, expect, it, vi } from "vitest";

import { getAuthoringSession, getOlderAuthoringTurns } from "./courseAuthoring.api";

import type { OpenAuthoringSessionResponse } from "~/api/generated-api";

const api = vi.hoisted(() => ({
  courseAuthoringControllerGetAuthoringSession: vi.fn(),
  courseAuthoringControllerGetOlderAuthoringTurns: vi.fn(),
}));
vi.mock("~/api/api-client", () => ({ ApiClient: { api } }));

const turns: NonNullable<OpenAuthoringSessionResponse["data"]["turns"]> = [
  {
    requestId: "request",
    messageId: "message",
    status: "completed",
    taskIds: [],
    firstSequence: 1,
    updatedSequence: 2,
    parts: [
      {
        requestId: "request",
        messageId: "message",
        partId: "search",
        partKind: "tool",
        status: "completed",
        firstSequence: 1,
        updatedSequence: 2,
        tool: {
          toolCallId: "search",
          toolName: "web_search",
          display: "Search",
          status: "completed",
          result: {
            queries: ["course evidence"],
            sources: [
              { url: "https://example.com/docs" },
              { url: "https://example.org/docs", title: "  Official docs  " },
              { url: "javascript:alert(1)", title: "Unsafe" },
            ],
          },
        },
      },
    ],
  },
];

const expectedSources = [
  { url: "https://example.com/docs", title: null },
  { url: "https://example.org/docs", title: "Official docs" },
];

describe("persisted authoring citations", () => {
  it("restores normalized citations and queries from a session snapshot", async () => {
    const session: OpenAuthoringSessionResponse["data"] = {
      schemaVersion: 1,
      sessionId: "session",
      courseId: "course",
      language: "pl",
      status: "active",
      snapshotSequence: 2,
      workspaceRevision: 0,
      records: [],
      tasks: [],
      turns,
    };
    api.courseAuthoringControllerGetAuthoringSession.mockResolvedValue({ data: { data: session } });

    const restored = await getAuthoringSession("course", "session");

    expect(restored.turns?.[0].parts[0].tool?.result).toEqual({
      queries: ["course evidence"],
      sources: expectedSources,
    });
    expect(turns[0].parts[0].tool?.result?.sources?.[0]).toEqual({
      url: "https://example.com/docs",
    });
  });

  it("normalizes older pages, including null citation lists", async () => {
    const emptyTurn = {
      ...turns[0],
      parts: [
        {
          ...turns[0].parts[0],
          tool: {
            ...turns[0].parts[0].tool!,
            result: { sources: null },
          },
        },
      ],
    };
    api.courseAuthoringControllerGetOlderAuthoringTurns.mockResolvedValue({
      data: {
        data: {
          turns: [...turns, emptyTurn],
          records: [],
          hasMore: false,
          nextBeforeRequestId: null,
        },
      },
    });

    const restored = await getOlderAuthoringTurns("course", "session", "before");

    expect(restored.turns[0].parts[0].tool?.result?.sources).toEqual(expectedSources);
    expect(restored.turns[1].parts[0].tool?.result?.sources).toEqual([]);
    expect(restored.hasMore).toBe(false);
  });
});
