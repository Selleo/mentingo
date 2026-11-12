import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runHttpCase } from "./http-adapter";

import type { HttpRunConfig, RegressionCase, RegressionDataset } from "./evaluation.types";

const dataset = JSON.parse(
  readFileSync(resolve(__dirname, "dataset.v1.json"), "utf8"),
) as RegressionDataset;
const findCase = (id: string): RegressionCase => {
  const item = dataset.cases.find((candidate) => candidate.id === id);
  if (!item) throw new Error("Missing regression case");
  return item;
};

describe("Core HTTP evaluation adapter with in-memory transport doubles", () => {
  const config: HttpRunConfig = {
    baseUrl: "http://127.0.0.1:3000/api",
    disposableTenant: true,
    allowAuthoringWrites: true,
    fixtures: {},
  };

  beforeEach(() => {
    process.env.CORE_EVALUATION_TEST_COOKIE = "synthetic-cookie";
    config.fixtures = {};
  });

  afterEach(() => {
    delete process.env.CORE_EVALUATION_TEST_COOKIE;
    jest.restoreAllMocks();
  });

  const fixture = (id: string, fields: Record<string, unknown>) => {
    config.fixtures[id] = { cookieEnv: "CORE_EVALUATION_TEST_COOKIE", isolated: true, ...fields };
  };
  const reply = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });

  it("requests real search contract and scores returned evidence rather than a supplied reference answer", async () => {
    const item = findCase("search-keyword-title");
    fixture(item.id, { expectedResultIds: ["readable"], forbiddenResultIds: ["private"] });
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(reply({ searchMode: "keyword", results: [{ id: "private" }] }));
    const result = await runHttpCase(item, config);
    expect(result.status).toBe("failed");
    expect(result.checks).toMatchObject({ expectedResults: false, forbiddenResults: false });
    expect(fetchMock.mock.calls[0][0]).toContain("/api/global-search?searchQuery=");
    expect(JSON.stringify(result)).not.toContain("synthetic-cookie");
  });

  it("does not accept a streamed response without persisted assistant evidence", async () => {
    const item = {
      ...findCase("mentor-teacher-multi-turn"),
      input: { turns: ["Where is reception?"] },
    };
    fixture(item.id, { threadId: "fresh-thread" });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(reply([]))
      .mockResolvedValueOnce(new Response("data: [DONE]"))
      .mockResolvedValueOnce(reply([{ role: "user", content: "Where is reception?" }]));
    const result = await runHttpCase(item, config);
    expect(result.status).toBe("failed");
    expect(result.checks.assistantTurnsPersisted).toBe(false);
  });

  it("persists both multi-turn messages and leaves semantic judgment pending", async () => {
    const item = findCase("mentor-teacher-multi-turn");
    fixture(item.id, { threadId: "fresh-thread" });
    const turns = item.input.turns as string[];
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(reply([]))
      .mockResolvedValueOnce(new Response("data: [DONE]"))
      .mockResolvedValueOnce(new Response("data: [DONE]"))
      .mockResolvedValueOnce(
        reply([
          { role: "user", content: turns[0] },
          { role: "assistant", content: "Ask reception for your free badge." },
          { role: "user", content: turns[1] },
          { role: "assistant", content: "You can confirm your name with reception." },
        ]),
      );
    const result = await runHttpCase(item, config);
    expect(result.status).toBe("needs_review");
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining("/ai/thread/messages?thread=fresh-thread"),
      expect.stringContaining("/ai/chat"),
      expect.stringContaining("/ai/chat"),
      expect.stringContaining("/ai/thread/messages?thread=fresh-thread"),
    ]);
  });

  it("refuses to append evaluation messages to a reused conversation", async () => {
    const item = findCase("mentor-teacher-multi-turn");
    fixture(item.id, { threadId: "old-thread" });
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(reply([{ role: "assistant", content: "Earlier response" }]));
    await expect(runHttpCase(item, config)).rejects.toThrow("not fresh");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    "valid",
    "resume-clarification",
    "missing-receipt",
    "wrong-identity",
    "untargeted-change",
  ])("validates authoring sequence: %s", async (variant) => {
    const item = findCase("authoring-title-only-native-roundtrip");
    fixture(item.id, {
      courseId: "course-1",
      ...(variant === "resume-clarification" ? { authoringResumeSessionId: "session-1" } : {}),
    });
    const before = {
      baselineHash: "a".repeat(64),
      course: { title: "Long original title", description: "Keep description" },
      chapters: [{ id: "chapter-1" }],
    };
    const operation = {
      operationId: "operation-1",
      targetId: "course-1",
      language: "en",
      type: "course.metadata.update",
      payload: { title: "Short title" },
    };
    const fetchMock = jest.spyOn(global, "fetch");
    for (const data of [
      {
        sessionId: "session-1",
        courseId: "course-1",
        language: "en",
        tasks: [{ taskId: "question-task", status: "waiting_author" }],
        records: [
          {
            kind: "request",
            payload: {
              requestId: "request-1",
              instruction: item.input.instruction,
              targets: [{ targetId: "course-1", language: "en", allowedFields: ["title"] }],
            },
          },
          {
            kind: "question",
            payload: {
              requestId: "request-1",
              taskId: "question-task",
              revision: 0,
              question: "Provide current context",
            },
          },
        ],
      },
      before,
      { taskIds: ["task-1"] },
      {
        records: [
          {
            kind: "proposal",
            payload: { id: "proposal-1", revision: 1, operations: [operation] },
          },
        ],
      },
      { accepted: true },
      { exportId: "export-1", status: "queued" },
      {
        status: "applied",
        receipt:
          variant === "missing-receipt"
            ? undefined
            : {
                status: "applied",
                exportId: variant === "wrong-identity" ? "another-export" : "export-1",
                courseId: "course-1",
                sessionId: "session-1",
                exportHash: "b".repeat(64),
                appliedOperationIds: ["operation-1"],
              },
      },
      {
        ...before,
        course: {
          ...before.course,
          title: "Short title",
          description:
            variant === "untargeted-change" ? "Unauthorized rewrite" : before.course.description,
        },
      },
    ])
      fetchMock.mockResolvedValueOnce(reply(data));
    const result = await runHttpCase(item, config);
    const valid = variant === "valid" || variant === "resume-clarification";
    expect(result.status).toBe(valid ? "needs_review" : "failed");
    expect(Object.values(result.checks).every(Boolean)).toBe(valid);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    const command = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    if (variant === "resume-clarification") {
      expect(command).toMatchObject({
        action: "question.answer",
        targetId: "question-task",
        expectedRevision: 0,
      });
      expect(JSON.parse(command.answer)).toMatchObject({
        currentCourse: before.course,
        allowedFields: ["title"],
      });
      expect(
        fetchMock.mock.calls.some(([, init]) => String(init?.body).includes("request.create")),
      ).toBe(false);
    } else
      expect(command.request.targets[0]).toMatchObject({
        baselineHash: before.baselineHash,
        allowedFields: ["title"],
      });
  });

  it("refuses to resume an unrelated saved clarification before answering", async () => {
    const item = findCase("authoring-title-only-native-roundtrip");
    fixture(item.id, { courseId: "course-1", authoringResumeSessionId: "session-1" });
    const transport = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        reply({
          sessionId: "session-1",
          courseId: "course-1",
          language: "en",
          tasks: [{ taskId: "question-task", status: "waiting_author" }],
          records: [
            {
              kind: "question",
              payload: { taskId: "question-task", requestId: "request-1", revision: 0 },
            },
            {
              kind: "request",
              payload: {
                requestId: "request-1",
                instruction: "Rewrite all lessons",
                targets: [{ targetId: "course-1", language: "en", allowedFields: ["lessons"] }],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(reply({ course: { title: "Original title" }, chapters: [] }));
    await expect(runHttpCase(item, config)).rejects.toThrow("unchanged title-only task");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });

  it("refuses authoring mutation without explicit write opt-in", async () => {
    const item = findCase("authoring-title-only-native-roundtrip");
    fixture(item.id, { courseId: "course-1" });
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(runHttpCase(item, { ...config, allowAuthoringWrites: undefined })).rejects.toThrow(
      "allowAuthoringWrites",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs proposal-only authoring without accepting or applying native changes", async () => {
    const original = findCase("authoring-title-only-native-roundtrip");
    const item = { ...original, input: { ...original.input, proposalOnly: true } };
    fixture(item.id, { courseId: "course-1" });
    const context = {
      baselineHash: "a".repeat(64),
      course: { title: "Long original title", description: "Keep" },
      chapters: [],
    };
    const fetchMock = jest.spyOn(global, "fetch");
    for (const data of [
      { sessionId: "session-1" },
      context,
      { taskIds: ["task-1"] },
      {
        records: [
          {
            kind: "proposal",
            payload: {
              id: "proposal-1",
              revision: 1,
              operations: [
                {
                  operationId: "operation-1",
                  type: "course.metadata.update",
                  targetId: "course-1",
                  language: "en",
                  payload: { title: "Short title" },
                },
              ],
            },
          },
        ],
      },
      context,
    ])
      fetchMock.mockResolvedValueOnce(reply(data));
    const result = await runHttpCase(item, config);
    expect(result.status).toBe("needs_review");
    expect(result.checks.nativeCourseUnchanged).toBe(true);
    expect(result.evidence.nativeApplyAttempted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/applications"))).toBe(false);
    expect(
      fetchMock.mock.calls
        .filter(([, init]) => init?.body)
        .some(([, init]) => String(init?.body).includes("proposal.accept")),
    ).toBe(false);
  });

  it("rejects unavailable or malformed application results", async () => {
    const item = findCase("search-keyword-title");
    fixture(item.id, { expectedResultIds: ["readable"], forbiddenResultIds: [] });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("internal details", { status: 500 }));
    await expect(runHttpCase(item, config)).rejects.toThrow("HTTP 500");
  });
  it.each(["valid", "untyped-failure", "lost-edit"])(
    "requires a real concurrent edit, typed baseline conflict and canonical readback (%s)",
    async (variant) => {
      const original = findCase("authoring-title-only-native-roundtrip");
      const item = { ...original, input: { ...original.input, staleBaseline: true } };
      fixture(item.id, { courseId: "course-1" });
      const before = {
        baselineHash: "a".repeat(64),
        course: { title: "Old title", description: "Keep" },
        chapters: [{ id: "chapter-1" }],
      };
      let current = before;
      const proposal = {
        id: "proposal-1",
        revision: 1,
        operations: [
          {
            type: "course.metadata.update",
            targetId: "course-1",
            operationId: "operation-1",
            language: "en",
            payload: { title: "Short title" },
          },
        ],
      };
      jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        if (init?.method === "PATCH") {
          const edit = JSON.parse(String(init.body));
          current = {
            ...before,
            baselineHash: "b".repeat(64),
            course: { ...before.course, title: edit.title },
          };
          return reply({ message: "Updated" });
        }
        if (url.includes("/context?")) return reply(current);
        if (url.endsWith("/applications") && init?.method === "POST")
          return reply({ exportId: "export-1" });
        if (url.includes("/applications/export-1")) {
          if (variant === "lost-edit") current = before;
          return reply({
            status: "conflict",
            reason:
              variant === "untyped-failure"
                ? "unrelated failure"
                : "courseAuthoring.errors.baselineChanged",
          });
        }
        if (url.endsWith("/sessions") && init?.method === "POST")
          return reply({ sessionId: "session-1" });
        if (url.endsWith("/commands")) return reply({ accepted: true });
        if (url.endsWith("/sessions/session-1"))
          return reply({ records: [{ kind: "proposal", payload: proposal }] });
        throw new Error("Unexpected native stale-driver request");
      });
      const result = await runHttpCase(item, config);
      expect(result.status).toBe(variant === "valid" ? "needs_review" : "failed");
      expect(result.evidence.submissionHttpStatus).toBe(200);
      expect(result.evidence.terminal).toMatchObject({ status: "conflict" });
      if (variant === "valid") expect(Object.values(result.checks).every(Boolean)).toBe(true);
    },
  );
  it("uploads and waits for the explicit synthetic source before creating an authoring request", async () => {
    const original = findCase("authoring-title-only-native-roundtrip");
    const item = { ...original, input: { ...original.input, proposalOnly: true } };
    fixture(item.id, {
      courseId: "course-1",
      authoringSourceText: "Synthetic source policy for this isolated title edit.",
    });
    const context = {
      baselineHash: "a".repeat(64),
      course: { title: "Long original title" },
      chapters: [],
    };
    const proposal = {
      id: "proposal-1",
      revision: 1,
      operations: [
        {
          type: "course.metadata.update",
          operationId: "operation-1",
          targetId: "course-1",
          language: "en",
          payload: { title: "Short title" },
        },
      ],
    };
    const transport = jest.spyOn(global, "fetch");
    for (const data of [
      { sessionId: "session-1" },
      context,
      { sourceVersionId: "source-1", taskId: "source-task-1" },
      { tasks: [{ taskId: "source-task-1", status: "succeeded" }] },
      { accepted: true },
      { records: [{ kind: "proposal", payload: proposal }] },
      context,
    ])
      transport.mockResolvedValueOnce(reply(data));
    const result = await runHttpCase(item, config);
    expect(result.status).toBe("needs_review");
    expect(String(transport.mock.calls[2][0])).toContain("/sources");
    expect(transport.mock.calls[2][1]?.body).toBeInstanceOf(FormData);
    const command = JSON.parse(String(transport.mock.calls[4][1]?.body));
    expect(command.request.sourcePolicy).toMatchObject({
      sourceVersionIds: ["source-1"],
      generalKnowledgeEnabled: false,
      webEnabled: false,
    });
    expect(result.evidence.sourceIngestion).toMatchObject({
      sourceVersionId: "source-1",
      taskId: "source-task-1",
      ready: true,
    });
  });
  it("refuses a mismatched authenticated actor before any native action", async () => {
    const item = findCase("mentor-teacher-multi-turn");
    fixture(item.id, { actorUserId: "expected-actor", threadId: "thread-1" });
    const transport = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(reply({ id: "different-actor", roleSlugs: ["student"], permissions: [] }));
    await expect(runHttpCase(item, config)).rejects.toThrow("actor does not match");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0][0])).toContain("/auth/current-user");
  });

  it("retains bounded native HTTP readback evidence without recording session cookies", async () => {
    const item = findCase("search-keyword-title");
    fixture(item.id, {
      actorUserId: "actor-1",
      expectedResultIds: ["readable"],
      forbiddenResultIds: [],
    });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        reply({ id: "actor-1", roleSlugs: ["student"], permissions: ["synthetic-read"] }),
      )
      .mockResolvedValueOnce(reply({ searchMode: "keyword", results: [{ id: "readable" }] }));
    const result = await runHttpCase(item, config);
    expect(result.status).toBe("passed");
    expect(result.evidence.nativeTransport).toMatchObject({
      authentication: { actor: { id: "actor-1" }, cookieEnv: "CORE_EVALUATION_TEST_COOKIE" },
      providerInternalsCaptured: false,
    });
    const serialized = JSON.stringify(result.evidence);
    expect(serialized).toContain("responseSha256");
    expect(serialized).not.toContain("synthetic-cookie");
  });
});
