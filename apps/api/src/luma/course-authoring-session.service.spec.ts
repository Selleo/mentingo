import { ForbiddenException, Logger } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { AxiosError, AxiosHeaders } from "axios";
import { validate as isUuid } from "uuid";

import { CourseAuthoringSessionService } from "./course-authoring-session.service";
import { authoringSessionSchema } from "./schema/course-authoring-session.schema";

import type { CourseAuthoringContextService } from "./course-authoring-context.service";
import type { LumaService } from "./luma.service";
import type { AuthoringCommandBody } from "./schema/course-authoring-session.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

const courseId = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";
const commandId = "00000000-0000-4000-8000-000000000003";
const oldVersion = "00000000-0000-4000-8000-000000000004";
const newVersion = "00000000-0000-4000-8000-000000000005";
const taskId = "00000000-0000-4000-8000-000000000008";
const requestId = "00000000-0000-4000-8000-000000000009";
const actor: CurrentUserType = {
  userId: "00000000-0000-4000-8000-000000000006",
  tenantId: "00000000-0000-4000-8000-000000000007",
  email: "author@example.test",
  roleSlugs: [],
  permissions: [],
};

describe("CourseAuthoringSessionService source refresh", () => {
  beforeAll(() => FormatRegistry.Set("uuid", isUuid));

  function setup() {
    const authorize = jest.fn().mockResolvedValue(undefined);
    const getContext = jest.fn().mockResolvedValue({
      courseId,
      language: SUPPORTED_LANGUAGES.EN,
      baselineHash: "b".repeat(64),
      course: {},
      chapters: [],
    });
    const totals = {
      invocationCount: 0,
      pendingInvocationCount: 0,
      unknownTokenInvocationCount: 0,
      unknownCostInvocationCount: 0,
      reportedCostInvocationCount: 0,
      estimatedCostInvocationCount: 0,
      configurationEstimateInvocationCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reportedUsd: "0",
      estimatedUsd: "0",
      knownUsd: "0",
      tokensComplete: true,
      costComplete: true,
    };
    const snapshot = {
      schemaVersion: 1,
      sessionId,
      courseId,
      language: SUPPORTED_LANGUAGES.EN,
      status: "active",
      snapshotSequence: 4,
      workspaceRevision: 4,
      records: [],
      turns: [
        {
          requestId,
          messageId: "message-1",
          status: "completed",
          taskIds: [taskId],
          firstSequence: 1,
          updatedSequence: 4,
          parts: [
            {
              requestId,
              messageId: "message-1",
              partId: "part-tool-1",
              partKind: "tool",
              taskId,
              status: "completed",
              firstSequence: 2,
              updatedSequence: 3,
              tool: {
                toolCallId: "tool-call-1",
                toolName: "research",
                display: "Searched course sources",
                status: "completed",
                result: {
                  sourceCount: 2,
                  findingCount: 1,
                  query: "EU AI Act official sources",
                  queries: ["EU AI Act application dates"],
                  sources: [{ url: "https://example.org/official", title: "Official guidance" }],
                },
              },
            },
          ],
        },
      ],
      tasks: [
        {
          taskId,
          requestId,
          kind: "route",
          status: "succeeded",
          errorCode: null,
          outputId: null,
        },
      ],
      usage: { total: totals, byTask: [], byRequest: [], byApiKey: [] },
    };
    const receipt = {
      commandId,
      hash: "a".repeat(64),
      acceptedSequence: 6,
      workspaceRevision: 6,
      requestId: null,
      taskIds: null,
      refreshId: commandId,
      refreshStatus: "needs_mapping",
    };
    const createSession = jest.fn().mockResolvedValue(snapshot);
    const getSession = jest.fn().mockResolvedValue(snapshot);
    const sendCommand = jest.fn().mockResolvedValue(receipt);
    const service = new CourseAuthoringSessionService(
      {
        getLumaClient: jest
          .fn()
          .mockResolvedValue({ authoring: { createSession, getSession, sendCommand } }),
      } as unknown as LumaService,
      {
        authorize,
        getContext,
        prepareBlockIdentities: jest.fn(),
      } as unknown as CourseAuthoringContextService,
      { bind: jest.fn() } as never,
    );
    const input: AuthoringCommandBody = {
      schemaVersion: 1,
      commandId,
      action: "source.refresh",
      targetId: oldVersion,
      replacementSourceVersionId: newVersion,
    };
    return { service, authorize, snapshot, receipt, createSession, getSession, sendCommand, input };
  }

  it("omits legacy upstream accounting while preserving the reasoning control", async () => {
    const test = setup();
    test.getSession.mockResolvedValue({ ...test.snapshot, reasoningControlAvailable: true });
    const result = await test.service.get(courseId, sessionId, actor);
    expect(result).not.toHaveProperty("usage");
    expect(result.reasoningControlAvailable).toBe(true);
    expect(Value.Check(authoringSessionSchema, test.snapshot)).toBe(false);
  });

  it("accepts a producer snapshot without accounting", async () => {
    const test = setup();
    const { usage: _usage, ...snapshot } = test.snapshot;
    test.getSession.mockResolvedValue(snapshot);
    expect(Value.Check(authoringSessionSchema, snapshot)).toBe(true);
    await expect(test.service.get(courseId, sessionId, actor)).resolves.toEqual(snapshot);
  });

  it.each([true, false])(
    "opens legacy and current snapshots without exposing accounting (legacy=%s)",
    async (legacy) => {
      const test = setup();
      const { usage: _usage, ...snapshot } = test.snapshot;
      const producerSnapshot = legacy ? test.snapshot : snapshot;
      test.createSession.mockResolvedValue({
        ...producerSnapshot,
        reasoningControlAvailable: true,
      });
      const result = await test.service.open(
        courseId,
        { commandId, language: SUPPORTED_LANGUAGES.EN },
        actor,
      );
      expect(result).not.toHaveProperty("usage");
      expect(result.reasoningControlAvailable).toBe(true);
      expect(result.sessionId).toBe(sessionId);
    },
  );

  it("forwards the exact source replacement with the authenticated actor and preserves mapping status", async () => {
    const test = setup();
    const result = await test.service.command(courseId, sessionId, test.input, actor);
    expect(test.authorize).toHaveBeenCalledWith(courseId, actor);
    expect(test.sendCommand).toHaveBeenCalledWith({
      sessionId,
      command: { ...test.input, actorId: actor.userId },
    });
    expect(result).toEqual(test.receipt);
  });

  it("forwards message-owned attachments separately from the reusable source policy", async () => {
    const test = setup();
    const input: AuthoringCommandBody = {
      schemaVersion: 1,
      commandId,
      action: "request.create",
      request: {
        instruction: "Use the attached handbook.",
        targets: [],
        sourcePolicy: {
          sourceVersionIds: [oldVersion, newVersion],
          webEnabled: false,
          generalKnowledgeEnabled: false,
          researchDepth: "standard",
          requiredSectionIds: [],
          excludedSectionIds: [],
        },
        attachedSourceVersionIds: [oldVersion],
      },
    };

    await test.service.command(courseId, sessionId, input, actor);

    expect(test.sendCommand).toHaveBeenCalledWith({
      sessionId,
      command: expect.objectContaining({
        actorId: actor.userId,
        request: expect.objectContaining({
          attachedSourceVersionIds: [oldVersion],
          sourcePolicy: expect.objectContaining({ sourceVersionIds: [oldVersion, newVersion] }),
        }),
      }),
    });
  });

  it("forwards an atomic proposal review with its request fence", async () => {
    const test = setup();
    const proposalId = "00000000-0000-4000-8000-000000000010";
    const input: AuthoringCommandBody = {
      schemaVersion: 1,
      commandId,
      action: "proposal.review",
      requestId,
      reviews: [
        {
          proposalId,
          expectedRevision: 2,
          accepted: true,
          acceptQualityConcerns: true,
        },
      ],
    };

    await test.service.command(courseId, sessionId, input, actor);

    expect(test.sendCommand).toHaveBeenCalledWith({
      sessionId,
      command: { ...input, actorId: actor.userId },
    });
  });

  it("forwards targeted regeneration feedback with the proposal revision", async () => {
    const test = setup();
    const input: AuthoringCommandBody = {
      schemaVersion: 1,
      commandId,
      action: "proposal.regenerate",
      targetId: "00000000-0000-4000-8000-000000000010",
      expectedRevision: 2,
      feedback: "Keep the existing example and shorten the introduction.",
    };

    await test.service.command(courseId, sessionId, input, actor);

    expect(test.sendCommand).toHaveBeenCalledWith({
      sessionId,
      command: { ...input, actorId: actor.userId },
    });
  });

  it("forwards staged proposal feedback as one regeneration batch", async () => {
    const test = setup();
    const input: AuthoringCommandBody = {
      schemaVersion: 1,
      commandId,
      action: "proposal.regenerate.batch",
      regenerations: [
        {
          targetId: "00000000-0000-4000-8000-000000000010",
          expectedRevision: 2,
          feedback: "Keep the quiz and add a worked example.",
        },
      ],
    };

    await test.service.command(courseId, sessionId, input, actor);

    expect(test.sendCommand).toHaveBeenCalledWith({
      sessionId,
      command: { ...input, actorId: actor.userId },
    });
  });

  it("accepts route task kinds while retaining compatibility with older snapshots", async () => {
    const test = setup();

    await expect(test.service.get(courseId, sessionId, actor)).resolves.toMatchObject({
      tasks: [{ taskId, requestId, kind: "route" }],
    });

    test.getSession.mockResolvedValue({
      ...test.snapshot,
      tasks: [
        {
          taskId,
          requestId,
          status: "succeeded",
          errorCode: null,
          outputId: null,
        },
      ],
    });

    await expect(test.service.get(courseId, sessionId, actor)).resolves.toMatchObject({
      tasks: [{ taskId, requestId }],
    });
  });

  it("accepts completed course review tasks from the producer snapshot", async () => {
    const test = setup();
    test.getSession.mockResolvedValue({
      ...test.snapshot,
      tasks: [
        {
          taskId,
          requestId,
          kind: "course_review",
          status: "succeeded",
          errorCode: null,
          outputId: null,
        },
      ],
    });
    await expect(test.service.get(courseId, sessionId, actor)).resolves.toMatchObject({
      tasks: [{ taskId, kind: "course_review", status: "succeeded" }],
    });
  });

  it("rejects unknown task kinds and logs only invalid field paths", async () => {
    const test = setup();
    const errorLog = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    try {
      test.getSession.mockResolvedValue({
        ...test.snapshot,
        tasks: [
          {
            taskId,
            requestId,
            kind: "private-response-content",
            status: "succeeded",
            errorCode: null,
            outputId: null,
          },
        ],
      });
      await expect(test.service.get(courseId, sessionId, actor)).rejects.toThrow(
        "courseAuthoring.errors.invalidServiceResponse",
      );
      expect(errorLog).toHaveBeenCalledWith({
        message: "Authoring producer response failed validation",
        invalidPaths: ["/tasks/0/kind"],
      });
    } finally {
      errorLog.mockRestore();
    }
  });

  it("preserves typed ordered turns and bounded tool results from the snapshot", async () => {
    const test = setup();

    await expect(test.service.get(courseId, sessionId, actor)).resolves.toMatchObject({
      turns: [
        {
          requestId,
          status: "completed",
          firstSequence: 1,
          parts: [
            {
              partId: "part-tool-1",
              partKind: "tool",
              firstSequence: 2,
              updatedSequence: 3,
              tool: {
                toolName: "research",
                result: {
                  sourceCount: 2,
                  findingCount: 1,
                  query: "EU AI Act official sources",
                  queries: ["EU AI Act application dates"],
                  sources: [{ url: "https://example.org/official", title: "Official guidance" }],
                },
              },
            },
          ],
        },
      ],
    });
  });

  it("rejects a session belonging to another course before sending the replacement", async () => {
    const test = setup();
    test.getSession.mockResolvedValue({ ...test.snapshot, courseId: newVersion });
    await expect(
      test.service.command(courseId, sessionId, test.input, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(test.sendCommand).not.toHaveBeenCalled();
  });

  it("rejects a different producer session before forwarding a command", async () => {
    const test = setup();
    test.getSession.mockResolvedValue({ ...test.snapshot, sessionId: newVersion });
    await expect(test.service.command(courseId, sessionId, test.input, actor)).rejects.toThrow(
      "courseAuthoring.errors.invalidServiceResponse",
    );
    expect(test.sendCommand).not.toHaveBeenCalled();
  });
  it("rejects a created session bound to another course", async () => {
    const test = setup();
    test.createSession.mockResolvedValue({ ...test.snapshot, courseId: newVersion });
    await expect(test.service.open(courseId, { commandId, language: "en" }, actor)).rejects.toThrow(
      "courseAuthoring.errors.invalidServiceResponse",
    );
  });
  it("rechecks editor access before each refresh", async () => {
    const test = setup();
    test.authorize.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      test.service.command(courseId, sessionId, test.input, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(test.getSession).not.toHaveBeenCalled();
    expect(test.sendCommand).not.toHaveBeenCalled();
  });

  it("explains an unfinished replacement instead of calling it a draft revision conflict", async () => {
    const test = setup();
    const error = new AxiosError("conflict");
    error.response = {
      status: 409,
      statusText: "Conflict",
      data: { detail: "source_refresh_replacement_not_processed" },
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
    test.sendCommand.mockRejectedValueOnce(error);
    await expect(test.service.command(courseId, sessionId, test.input, actor)).rejects.toThrow(
      "courseAuthoring.errors.sourceReplacementNotReady",
    );
  });
});

describe("CourseAuthoringSessionService list", () => {
  beforeAll(() => FormatRegistry.Set("uuid", isUuid));

  function setup() {
    const authorize = jest.fn().mockResolvedValue(undefined);
    const listSessions = jest.fn().mockResolvedValue({
      sessions: [
        {
          sessionId,
          courseId,
          language: SUPPORTED_LANGUAGES.EN,
          status: "active",
          title: "Create a compliance course",
          createdAt: "2026-09-22T08:00:00.000Z",
          lastActivityAt: "2026-09-22T08:01:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      perPage: 20,
      hasMore: false,
    });
    const service = new CourseAuthoringSessionService(
      {
        getLumaClient: jest.fn().mockResolvedValue({ authoring: { listSessions } }),
      } as unknown as LumaService,
      { authorize } as unknown as CourseAuthoringContextService,
      { bind: jest.fn() } as never,
    );
    return { service, authorize, listSessions };
  }

  it("forwards keyword and pagination to the producer and maps its page into mentingo's pagination shape", async () => {
    const test = setup();

    const result = await test.service.list(courseId, actor, {
      keyword: "compliance",
      page: 1,
      perPage: 20,
    });

    expect(test.authorize).toHaveBeenCalledWith(courseId, actor);
    expect(test.listSessions).toHaveBeenCalledWith({
      courseId,
      keyword: "compliance",
      page: 1,
      perPage: 20,
    });
    expect(result).toEqual({
      data: [
        {
          sessionId,
          courseId,
          language: SUPPORTED_LANGUAGES.EN,
          status: "active",
          title: "Create a compliance course",
          createdAt: "2026-09-22T08:00:00.000Z",
          lastActivityAt: "2026-09-22T08:01:00.000Z",
        },
      ],
      pagination: { totalItems: 1, page: 1, perPage: 20 },
    });
  });
});
