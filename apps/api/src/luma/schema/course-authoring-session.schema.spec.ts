import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { validate } from "uuid";

import {
  authoringCommandBodySchema,
  authoringTurnPartSchema,
} from "./course-authoring-session.schema";

const commandId = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const proposalId = "00000000-0000-4000-8000-000000000003";

describe("course authoring command schema", () => {
  beforeAll(() => FormatRegistry.Set("uuid", validate));

  it("accepts an atomic proposal review with a request fence", () => {
    expect(
      Value.Check(authoringCommandBodySchema, {
        schemaVersion: 1,
        commandId,
        action: "proposal.review",
        requestId,
        reviews: [
          {
            proposalId,
            expectedRevision: 1,
            accepted: true,
            acceptQualityConcerns: true,
          },
        ],
      }),
    ).toBe(true);
  });

  it.each([
    { reviews: [] },
    { reviews: [{ proposalId, expectedRevision: 0, accepted: true }] },
    {
      reviews: Array.from({ length: 101 }, () => ({
        proposalId,
        expectedRevision: 1,
        accepted: true,
      })),
    },
  ])("rejects an invalid proposal review batch", (payload) => {
    expect(
      Value.Check(authoringCommandBodySchema, {
        schemaVersion: 1,
        commandId,
        action: "proposal.review",
        ...payload,
      }),
    ).toBe(false);
  });

  it("does not permit the batch-only request fence on another command", () => {
    expect(
      Value.Check(authoringCommandBodySchema, {
        schemaVersion: 1,
        commandId,
        action: "session.pause",
        requestId,
      }),
    ).toBe(false);
  });

  it("bounds targeted regeneration feedback", () => {
    const command = {
      schemaVersion: 1,
      commandId,
      action: "proposal.regenerate",
      targetId: proposalId,
      expectedRevision: 1,
    };
    expect(
      Value.Check(authoringCommandBodySchema, { ...command, feedback: "Add a short example" }),
    ).toBe(true);
    expect(Value.Check(authoringCommandBodySchema, { ...command, feedback: "" })).toBe(false);
    expect(
      Value.Check(authoringCommandBodySchema, { ...command, feedback: "a".repeat(2001) }),
    ).toBe(false);
    expect(
      Value.Check(authoringCommandBodySchema, {
        ...command,
        action: "proposal.reject",
        feedback: "This action must not carry regeneration guidance",
      }),
    ).toBe(false);
  });

  it("accepts a bounded regeneration batch and rejects unrelated command fields", () => {
    const command = {
      schemaVersion: 1,
      commandId,
      action: "proposal.regenerate.batch",
      regenerations: [
        { targetId: proposalId, expectedRevision: 1, feedback: "Add a practical example" },
      ],
    };
    expect(Value.Check(authoringCommandBodySchema, command)).toBe(true);
    expect(Value.Check(authoringCommandBodySchema, { ...command, regenerations: [] })).toBe(false);
    expect(
      Value.Check(authoringCommandBodySchema, {
        ...command,
        regenerations: [{ ...command.regenerations[0], feedback: "" }],
      }),
    ).toBe(false);
    expect(Value.Check(authoringCommandBodySchema, { ...command, feedback: "extra" })).toBe(false);
  });

  it("accepts selected refresh tasks only on a source refresh command", () => {
    const selectedTaskIds = [requestId];
    const refresh = {
      schemaVersion: 1,
      commandId,
      action: "source.refresh",
      targetId: proposalId,
      replacementSourceVersionId: requestId,
      selectedTaskIds,
    };
    expect(Value.Check(authoringCommandBodySchema, refresh)).toBe(true);
    expect(
      Value.Check(authoringCommandBodySchema, {
        ...refresh,
        selectedTaskIds: [requestId, requestId],
      }),
    ).toBe(false);
    expect(Value.Check(authoringCommandBodySchema, { ...refresh, action: "session.pause" })).toBe(
      false,
    );
  });
});

describe("course authoring turn part schema", () => {
  beforeAll(() => FormatRegistry.Set("uuid", validate));

  it("accepts a completed clarification part with its durable answer", () => {
    expect(
      Value.Check(authoringTurnPartSchema, {
        requestId,
        messageId: "message-1",
        partId: "question:task-1:2",
        partKind: "question",
        taskId: proposalId,
        status: "completed",
        firstSequence: 1,
        updatedSequence: 2,
        answer: "The course is for first-time managers.",
        artifact: { artifactKind: "question", artifactId: "task-1:2" },
      }),
    ).toBe(true);
  });

  it("keeps turn parts strict around the new optional answer field", () => {
    const part = {
      requestId,
      messageId: "message-1",
      partId: "question:task-1:2",
      partKind: "question",
      taskId: proposalId,
      status: "completed",
      firstSequence: 1,
      updatedSequence: 2,
      answer: "A precise response.",
    };
    expect(Value.Check(authoringTurnPartSchema, { ...part, answer: null })).toBe(true);
    expect(Value.Check(authoringTurnPartSchema, { ...part, unsupported: true })).toBe(false);
  });

  it("accepts a short plan on an assistant text part", () => {
    expect(
      Value.Check(authoringTurnPartSchema, {
        requestId,
        messageId: "message-1",
        partId: "route-plan",
        partKind: "text",
        status: "completed",
        firstSequence: 1,
        updatedSequence: 1,
        text: "I’ll research and draft the course.",
        planSteps: ["Research Mentingo", "Draft lessons"],
      }),
    ).toBe(true);
  });
});
