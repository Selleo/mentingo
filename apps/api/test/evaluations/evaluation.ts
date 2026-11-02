import { isDeepStrictEqual } from "node:util";

import { GLOBAL_SEARCH_MODES, GLOBAL_SEARCH_SEMANTIC_STATUSES } from "@repo/shared";

import { evaluateAiJudgeResult } from "src/ai/utils/judgeEvaluation";

import type { CaseResult, JudgeInput, RegressionCase, RegressionDataset } from "./evaluation.types";

/** Refuse incomplete catalogues rather than silently dropping broken cases. */
export function validateDataset(dataset: RegressionDataset): void {
  if (
    dataset.version !== 1 ||
    !dataset.name ||
    !Array.isArray(dataset.cases) ||
    !dataset.cases.length
  )
    throw new Error("Invalid regression dataset");
  const ids = new Set<string>();
  for (const item of dataset.cases) {
    if (!item.id || ids.has(item.id)) throw new Error("Missing or duplicate case ID");
    ids.add(item.id);
    if (
      !["judge", "search", "mentor", "authoring", "prepared"].includes(item.execution) ||
      !item.flow ||
      !item.input ||
      !item.expected ||
      item.provenance !== "synthetic" ||
      item.reviewStatus !== "pending_domain_review" ||
      !Array.isArray(item.rubric) ||
      !Array.isArray(item.sourcePaths) ||
      !item.sourcePaths.length ||
      !Object.keys(item.expected).length
    )
      throw new Error(`Incomplete regression case: ${item.id}`);
  }
}

/** Execute the production score calculation; the dataset supplies independent expected facts. */
export function runJudgeCase(item: RegressionCase): CaseResult {
  const input = item.input as JudgeInput;
  try {
    const output = evaluateAiJudgeResult(input.result, input.rubric);
    if (typeof item.expected.error === "string") {
      return {
        caseId: item.id,
        status: "failed",
        checks: { rejectsInvalidResult: false },
        evidence: {},
      };
    }
    const checks = Object.fromEntries(
      Object.entries(item.expected).map(([key, expected]) => [
        key,
        isDeepStrictEqual(output[key as keyof typeof output], expected),
      ]),
    );
    return {
      caseId: item.id,
      status: Object.values(checks).every(Boolean) ? "passed" : "failed",
      checks,
      evidence: { output },
    };
  } catch (error) {
    const matched =
      typeof item.expected.error === "string" &&
      error instanceof Error &&
      error.message.includes(item.expected.error);
    return {
      caseId: item.id,
      status: matched ? "passed" : "failed",
      checks: { rejectsInvalidResult: matched },
      evidence: {},
    };
  }
}

/** Both nested lessons and parent nodes participate in access/relevance assertions. */
export function flattenSearchIds(results: unknown): string[] {
  if (!Array.isArray(results)) throw new Error("Search response lacks results");
  const ids: string[] = [];
  for (const node of results) {
    if (typeof node !== "object" || !node || typeof node.id !== "string")
      throw new Error("Search result lacks identity");
    ids.push(node.id);
    if (node.lessons !== undefined) ids.push(...flattenSearchIds(node.lessons));
  }
  return ids;
}

export function scoreSearch(
  item: RegressionCase,
  response: Record<string, unknown>,
  expectedIds: string[],
  forbiddenIds: string[],
): CaseResult {
  const ids = flattenSearchIds(response.results);
  const checks = {
    expectedResults: expectedIds.every((id) => ids.includes(id)),
    forbiddenResults: forbiddenIds.every((id) => !ids.includes(id)),
    uniqueResults: new Set(ids).size === ids.length,
    searchMode: response.searchMode === item.input.mode,
    readyIndex:
      item.input.mode !== GLOBAL_SEARCH_MODES.HYBRID ||
      response.semanticStatus === GLOBAL_SEARCH_SEMANTIC_STATUSES.READY,
    nonVacuousOracle:
      expectedIds.length + forbiddenIds.length > 0 || item.expected.emptyResults === true,
    expectedEmpty: item.expected.emptyResults !== true || ids.length === 0,
  };
  return completeCase(item, checks, {
    resultIds: ids,
    searchMode: response.searchMode,
    semanticStatus: response.semanticStatus,
  });
}

/** Semantic quality stays pending even when all transport/persistence checks passed. */
export function completeCase(
  item: RegressionCase,
  checks: Record<string, boolean>,
  evidence: Record<string, unknown>,
): CaseResult {
  let status: CaseResult["status"] = "failed";
  if (Object.keys(checks).length && Object.values(checks).every(Boolean)) {
    status = item.rubric.length ? "needs_review" : "passed";
  }
  return { caseId: item.id, status, checks, evidence };
}

/** Failure, unsupported execution, and pending review must stay visible in the denominator. */
export function summarize(results: CaseResult[]) {
  const counts = { passed: 0, failed: 0, needs_review: 0, not_run: 0 };
  for (const result of results) counts[result.status] += 1;
  return {
    total: results.length,
    ...counts,
    exitCode: counts.failed + counts.not_run > 0 ? 1 : Number(counts.needs_review > 0) * 2,
  };
}
