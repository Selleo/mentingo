import {
  ASSISTANT_MESSAGE_ROLES,
  ASSISTANT_MESSAGE_STATUSES,
  ASSISTANT_RUN_STATUSES,
  type AssistantTranscriptUpdate,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  ACTIVE_RUN_REFRESH_MS,
  applyAssistantTranscriptUpdate,
  assistantTranscriptRefetchInterval,
  keepNewerAssistantTranscript,
  settledAssistantMessages,
  type AssistantTranscriptCache,
} from "./assistantTranscriptCache";

function checkpoint(
  runId: string,
  timestamp: number,
  status: "running" | "completed" = "running",
): AssistantTranscriptUpdate {
  const updatedAt = new Date(timestamp).toISOString();
  return {
    threadId: "thread",
    run: {
      id: runId,
      threadId: "thread",
      status,
      workflowRunId: null,
      errorCode: null,
      activity: null,
      createdAt: new Date(runId === "run-1" ? 0 : 10).toISOString(),
      updatedAt,
    },
    assistantMessage: {
      id: `message-${runId}`,
      threadId: "thread",
      role: ASSISTANT_MESSAGE_ROLES.ASSISTANT,
      clientMessageId: null,
      status:
        status === "completed"
          ? ASSISTANT_MESSAGE_STATUSES.COMPLETE
          : ASSISTANT_MESSAGE_STATUSES.RUNNING,
      text: updatedAt,
      sources: [],
      createdAt: new Date(runId === "run-1" ? 1 : 11).toISOString(),
      updatedAt,
    },
  };
}

function transcript(update: AssistantTranscriptUpdate): AssistantTranscriptCache {
  return {
    pageParams: [1],
    pages: [
      {
        items: [update.assistantMessage],
        latestRun: update.run,
        totalItems: 1,
        page: 1,
        perPage: 50,
      },
    ],
  };
}

describe("Assistant realtime transcript", () => {
  it("replaces older replies with the saved full checkpoint and rejects late or duplicate events", () => {
    const partial = checkpoint("run-1", 2);
    const terminal = checkpoint("run-1", 3, "completed");
    const start = transcript(partial);
    const finished = applyAssistantTranscriptUpdate(start, terminal);

    expect(finished.pages[0].items).toEqual([terminal.assistantMessage]);
    expect(finished.pages[0].latestRun?.status).toBe(ASSISTANT_RUN_STATUSES.COMPLETED);
    expect(applyAssistantTranscriptUpdate(finished, partial)).toBe(finished);
    expect(applyAssistantTranscriptUpdate(finished, terminal)).toBe(finished);
    expect(keepNewerAssistantTranscript(finished, start)).toBe(finished);
  });

  it("compares incoming checkpoints against PostgreSQL snapshot timestamps", () => {
    const partial = checkpoint("run-1", 2);
    const start = transcript(partial);
    start.pages[0].latestRun = { ...partial.run, updatedAt: "1970-01-01 00:00:00.002+00" };
    expect(applyAssistantTranscriptUpdate(start, partial)).toBe(start);
  });

  it("merges a new run's user and Assistant messages in order across two loaded pages", () => {
    const previous = checkpoint("run-1", 3, "completed");
    const next = checkpoint("run-2", 11);
    const userMessage = {
      ...next.assistantMessage,
      id: "user-message",
      role: ASSISTANT_MESSAGE_ROLES.USER,
      status: ASSISTANT_MESSAGE_STATUSES.COMPLETE,
    };
    const start = transcript(previous);
    start.pages[0].perPage = 2;
    start.pages.push({ ...start.pages[0], page: 2, items: [] });
    start.pageParams.push(2);
    const updated = applyAssistantTranscriptUpdate(start, { ...next, userMessage });

    expect(updated.pages[0].items).toEqual([userMessage, next.assistantMessage]);
    expect(updated.pages[1].items).toEqual([previous.assistantMessage]);
    expect(updated.pages[0].totalItems).toBe(3);
  });

  it("waits for an HTTP snapshot if a new run arrives without the persisted user turn", () => {
    const start = transcript(checkpoint("run-1", 3, "completed"));
    expect(applyAssistantTranscriptUpdate(start, checkpoint("run-2", 11))).toBe(start);
  });

  it("keeps an older page loaded while a realtime checkpoint advanced the run", () => {
    const olderReply = checkpoint("run-1", 3, "completed");
    const partial = checkpoint("run-2", 12);
    const fetchStart = transcript(partial);
    fetchStart.pages[0].totalItems = 2;
    const current = applyAssistantTranscriptUpdate(fetchStart, checkpoint("run-2", 13));
    const fetched: AssistantTranscriptCache = {
      pageParams: [1, 2],
      pages: [
        fetchStart.pages[0],
        { ...fetchStart.pages[0], page: 2, items: [olderReply.assistantMessage] },
      ],
    };

    const merged = keepNewerAssistantTranscript(current, fetched) as AssistantTranscriptCache;

    expect(merged.pageParams).toEqual([1, 2]);
    expect(merged.pages[0]).toBe(current.pages[0]);
    expect(merged.pages[1].items).toEqual([olderReply.assistantMessage]);
    expect(merged.pages[1].latestRun).toEqual(current.pages[0].latestRun);
    expect(keepNewerAssistantTranscript(current, fetchStart)).toBe(current);
  });

  it("reconciles over HTTP only while the latest run is active", () => {
    expect(assistantTranscriptRefetchInterval(undefined)).toBe(false);
    expect(assistantTranscriptRefetchInterval(transcript(checkpoint("run-1", 2)))).toBe(
      ACTIVE_RUN_REFRESH_MS,
    );
    expect(
      assistantTranscriptRefetchInterval(transcript(checkpoint("run-1", 3, "completed"))),
    ).toBe(false);
  });

  it("clears stale pending UI when a legacy snapshot reports a terminal run", () => {
    const partial = checkpoint("run-1", 2);
    const terminal = checkpoint("run-1", 3, "completed");
    expect(settledAssistantMessages([partial.assistantMessage], terminal.run)).toEqual([
      { ...partial.assistantMessage, status: ASSISTANT_MESSAGE_STATUSES.COMPLETE },
    ]);
  });
});
