import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateDataset } from "./evaluation";
import { runHttpCase } from "./http-adapter";

import type { HttpRunConfig, RegressionCase, RegressionDataset } from "./evaluation.types";

const dataset = JSON.parse(
  readFileSync(resolve(__dirname, "assessment-cases.v1.json"), "utf8"),
) as RegressionDataset;
const ids = { B1: "persisted-mfa-blocker", B2: "persisted-password-blocker" };
const configFor = (item: RegressionCase): HttpRunConfig => ({
  baseUrl: "http://127.0.0.1:3000/api",
  disposableTenant: true,
  fixtures: {
    [item.id]: {
      isolated: true,
      cookieEnv: "CORE_ASSESSMENT_TEST_COOKIE",
      threadId: "isolated-thread",
      lessonId: "isolated-lesson",
      blockingErrorIds: ids,
    },
  },
});
const responses = (item: RegressionCase) => {
  const configured = item.input.rubric as any;
  const thread = {
    id: "isolated-thread",
    aiMentorLessonId: "mentor-lesson",
    status: "active",
    userLanguage: item.input.language,
  };
  return [
    thread,
    {
      ...configured,
      language: item.input.language,
      aiMentorLessonId: "mentor-lesson",
      blockingErrors: configured.blockingErrors.map((blocker: any) => ({
        id: ids[blocker.ref as keyof typeof ids],
        description: blocker.description,
      })),
    },
    item.input.transcript,
    {
      passed: item.expected.passed,
      criteria: [],
      score: 0,
      maxScore: 0,
      blockingErrors: (item.expected.blockerRefs as Array<keyof typeof ids>).map((ref) => ({
        blockingErrorId: ids[ref],
      })),
    },
    { ...thread, status: "completed" },
  ];
};
const mockResponses = (values: unknown[]) => {
  const mock = jest.spyOn(global, "fetch");
  for (const data of values) mock.mockResolvedValueOnce(new Response(JSON.stringify({ data })));
  return mock;
};

describe("issue 2019 semantic blocker fixtures and actual Core endpoint adapter", () => {
  beforeEach(() => {
    process.env.CORE_ASSESSMENT_TEST_COOKIE = "synthetic-cookie";
  });
  afterEach(() => {
    delete process.env.CORE_ASSESSMENT_TEST_COOKIE;
    jest.restoreAllMocks();
  });

  it("contains bilingual scoped minimal pairs grounded in verified history", () => {
    validateDataset(dataset);
    expect(dataset.cases.length).toBe(20);
    expect(
      dataset.cases.some((item) => item.input.language === "pl" && item.expected.passed === true),
    ).toBe(true);
    expect(
      dataset.cases.some((item) => item.input.language === "pl" && item.expected.passed === false),
    ).toBe(true);
    expect(
      dataset.cases.find((item) => item.id.endsWith("client-denial-en"))?.expected.blockerRefs,
    ).toEqual([]);
    expect(
      dataset.cases.find((item) => item.id.endsWith("client-admission-en"))?.expected.blockerRefs,
    ).toEqual(["B1"]);
  });

  it.each(dataset.cases)(
    "$id verifies native policy/transcript/completion (transport fake only)",
    async (item) => {
      const fetchMock = mockResponses(responses(item));
      const result = await runHttpCase(item, configFor(item));
      expect(result.status).toBe("passed");
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        expect.stringContaining("/ai/thread?thread=isolated-thread"),
        expect.stringContaining("/lesson/isolated-lesson/ai-judge-configuration?language="),
        expect.stringContaining("/ai/thread/messages?thread=isolated-thread"),
        expect.stringContaining("/ai/judge/isolated-thread"),
        expect.stringContaining("/ai/thread?thread=isolated-thread"),
      ]);
      expect(fetchMock.mock.calls[3][1]?.method).toBe("POST");
      expect(result.evidence.nativeThreadStatus).toBe("completed");
    },
  );

  it("detects the original false blocking failure instead of accepting arithmetic success", async () => {
    const item = dataset.cases.find((candidate) => candidate.id.endsWith("client-denial-en"));
    if (!item) throw new Error("Missing negation regression");
    const values = responses(item) as any[];
    values[3] = {
      passed: false,
      criteria: [],
      score: 0,
      maxScore: 0,
      blockingErrors: [{ blockingErrorId: ids.B1 }],
    };
    mockResponses(values);
    const result = await runHttpCase(item, configFor(item));
    expect(result.status).toBe("failed");
    expect(result.checks).toMatchObject({ expectedPass: false, exactVerifiedBlockers: false });
  });

  it("refuses a positive oracle when configured blocker identity is absent", async () => {
    const item = dataset.cases[0];
    const config = configFor(item);
    config.fixtures[item.id].blockingErrorIds = {};
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(runHttpCase(item, config)).rejects.toThrow("Every configured blocker");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a different native rubric before calling the judge", async () => {
    const item = dataset.cases[0];
    const values = responses(item) as any[];
    values[1].blockingErrors = [];
    const fetchMock = mockResponses(values);
    await expect(runHttpCase(item, configFor(item))).rejects.toThrow("Persisted assessment rubric");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not accept a transient grade unless the native owned thread completed", async () => {
    const item = dataset.cases[0];
    const values = responses(item) as any[];
    values[4].status = "active";
    mockResponses(values);
    const result = await runHttpCase(item, configFor(item));
    expect(result.status).toBe("failed");
    expect(result.checks.nativeThreadCompleted).toBe(false);
  });
});
