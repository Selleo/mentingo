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

  it.each(["valid", "missing-receipt", "wrong-identity", "untargeted-change"])(
    "validates authoring sequence: %s",
    async (variant) => {
      const item = findCase("authoring-title-only-native-roundtrip");
      fixture(item.id, { courseId: "course-1" });
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
        before,
        { sessionId: "session-1" },
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
      expect(result.status).toBe(variant === "valid" ? "needs_review" : "failed");
      expect(Object.values(result.checks).every(Boolean)).toBe(variant === "valid");
      expect(fetchMock).toHaveBeenCalledTimes(8);
      const command = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
      expect(command.request.targets[0]).toMatchObject({
        baselineHash: before.baselineHash,
        allowedFields: ["title"],
      });
    },
  );

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
      context,
      { sessionId: "session-1" },
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
});
