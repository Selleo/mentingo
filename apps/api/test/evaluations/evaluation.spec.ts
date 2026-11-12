import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  completeCase,
  flattenSearchIds,
  runJudgeCase,
  scoreSearch,
  summarize,
  validateDataset,
} from "./evaluation";
import { validateHttpConfig } from "./http-adapter";

import type { RegressionCase, RegressionDataset } from "./evaluation.types";

const dataset = JSON.parse(
  readFileSync(resolve(__dirname, "dataset.v1.json"), "utf8"),
) as RegressionDataset;
const findCase = (id: string): RegressionCase => {
  const item = dataset.cases.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing regression case: ${id}`);
  return item;
};

describe("Core AI regression dataset", () => {
  it("validates all cases and repository evidence links", () => {
    validateDataset(dataset);
    for (const item of dataset.cases)
      for (const path of item.sourcePaths)
        expect(existsSync(resolve(__dirname, "../../../..", path))).toBe(true);
  });

  it.each(dataset.cases.filter((item) => item.execution === "judge"))(
    "$id calls production grading",
    (item) => {
      expect(runJudgeCase(item).status).toBe("passed");
    },
  );

  it("detects a deliberately wrong expected grade rather than scoring the reference itself", () => {
    const item = findCase("judge-at-threshold");
    expect(runJudgeCase({ ...item, expected: { ...item.expected, passed: false } }).status).toBe(
      "failed",
    );
  });

  it("rejects duplicate IDs and empty or missing expected evidence", () => {
    expect(() =>
      validateDataset({ ...dataset, cases: [dataset.cases[0], dataset.cases[0]] }),
    ).toThrow();
    expect(() =>
      validateDataset({ ...dataset, cases: [{ ...dataset.cases[0], expected: {} }] }),
    ).toThrow();
    expect(() => flattenSearchIds(undefined)).toThrow();
  });

  it("catches inaccessible nested lessons and a missing relevant result", () => {
    const item = findCase("search-nested-lesson-access");
    const response = {
      searchMode: "hybrid",
      semanticStatus: "ready",
      results: [{ id: "visible-parent", lessons: [{ id: "hidden-child" }] }],
    };
    expect(
      scoreSearch(item, response, ["missing-relevant"], ["hidden-child"]).checks,
    ).toMatchObject({ expectedResults: false, forbiddenResults: false });
    expect(scoreSearch(item, response, [], []).status).toBe("failed");
  });

  it("requires genuinely empty results for a no-answer oracle", () => {
    const item = findCase("search-no-readable-match");
    expect(
      scoreSearch(item, { searchMode: "keyword", results: [{ id: "unrelated" }] }, [], ["hidden"])
        .status,
    ).toBe("failed");
    expect(scoreSearch(item, { searchMode: "keyword", results: [] }, [], ["hidden"]).status).toBe(
      "passed",
    );
  });

  it("does not accept hybrid keyword fallback as a successful semantic regression", () => {
    const item = findCase("search-hybrid-paraphrase");
    expect(
      scoreSearch(
        item,
        { searchMode: "hybrid", semanticStatus: "unavailable", results: [{ id: "relevant" }] },
        ["relevant"],
        [],
      ).status,
    ).toBe("failed");
  });

  it("keeps semantic review pending and missing transport checks failing", () => {
    const item = findCase("mentor-teacher-multi-turn");
    expect(completeCase(item, { persisted: true }, { reply: "placeholder" }).status).toBe(
      "needs_review",
    );
    expect(completeCase(item, {}, {}).status).toBe("failed");
    expect(completeCase(item, { persisted: false }, {}).status).toBe("failed");
  });

  it("counts unsupported cases and review work instead of dropping them", () => {
    expect(
      summarize([
        { caseId: "a", status: "passed", checks: {}, evidence: {} },
        { caseId: "b", status: "not_run", checks: {}, evidence: {} },
        { caseId: "c", status: "failed", checks: {}, evidence: {} },
        { caseId: "d", status: "needs_review", checks: {}, evidence: {} },
      ]),
    ).toEqual({ total: 4, passed: 1, failed: 1, needs_review: 1, not_run: 1, exitCode: 1 });
    expect(
      summarize([{ caseId: "d", status: "needs_review", checks: {}, evidence: {} }]).exitCode,
    ).toBe(2);
  });

  it("refuses remote hosts, implicit fixture isolation and shared mutable fixtures", () => {
    const fixture = {
      isolated: true as const,
      cookieEnv: "SYNTHETIC_COOKIE",
      threadId: "test-thread",
    };
    expect(() =>
      validateHttpConfig({
        baseUrl: "https://production.invalid/api",
        disposableTenant: true,
        fixtures: {},
      }),
    ).toThrow();
    expect(() =>
      validateHttpConfig({
        baseUrl: "http://127.0.0.1:3000/api",
        disposableTenant: true,
        fixtures: { a: fixture, b: fixture },
      }),
    ).toThrow();
    expect(() =>
      validateHttpConfig({
        baseUrl: "http://127.0.0.1:3000/api",
        disposableTenant: true,
        fixtures: { a: fixture },
      }),
    ).not.toThrow();
  });
});
