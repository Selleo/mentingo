import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  EVALUATOR_SYSTEM,
  EVALUATOR_VERSION,
  evidenceForCapture,
  evaluateSemantic,
  sha256,
  validateSemanticRegistry,
} from "./semantic-evaluator";
import { createSemanticProvider } from "./semantic-provider";

import type { CaseResult } from "./evaluation.types";
import type {
  EvidenceRecord,
  SemanticEvaluation,
  SemanticProviderConfig,
  SemanticRegistry,
  SemanticStatus,
} from "./semantic-evaluator.types";

type SemanticRunOptions = {
  mode: string;
  out?: string;
  capture?: string;
  judgeConfig?: string;
  allowJudgeRequests?: boolean;
  cases?: string[];
};
type CaptureReport = {
  mode: "http";
  datasetSha256: string;
  runnerCommit: string;
  createdAt: string;
  selection: string[];
  results: CaseResult[];
};

/** Reject arbitrary JSON/fixture candidates masquerading as captured application output. */
export function validateCaptureReport(
  value: unknown,
  acceptedDatasetHashes: string[],
): CaptureReport {
  if (!value || typeof value !== "object") throw new Error("Capture report is missing");
  const report = value as CaptureReport;
  if (
    report.mode !== "http" ||
    !acceptedDatasetHashes.includes(report.datasetSha256) ||
    !/^[a-f0-9]{40}$/.test(report.runnerCommit) ||
    !Number.isFinite(Date.parse(report.createdAt)) ||
    !Array.isArray(report.selection) ||
    !Array.isArray(report.results) ||
    !report.results.length ||
    report.selection.length !== report.results.length ||
    new Set(report.selection).size !== report.selection.length
  )
    throw new Error("Capture provenance or dataset version is invalid");
  for (const result of report.results) {
    if (
      !result ||
      !report.selection.includes(result.caseId) ||
      !["passed", "failed", "needs_review", "not_run"].includes(result.status) ||
      !result.evidence ||
      typeof result.evidence !== "object" ||
      !result.checks ||
      typeof result.checks !== "object" ||
      Object.values(result.checks).some((check) => typeof check !== "boolean")
    )
      throw new Error("Capture result is invalid");
  }
  if (new Set(report.results.map((result) => result.caseId)).size !== report.results.length)
    throw new Error("Capture duplicates a case");
  return report;
}

/** Proposed labels measure judge discrimination; invalid runs never count as agreements. */
export function summarizeCalibration(
  samples: Array<{ expected: Record<string, SemanticStatus>; evaluation: SemanticEvaluation }>,
) {
  const dimensions: Record<
    string,
    {
      samples: number;
      judged: number;
      agreement: number;
      falsePass: number;
      falseFail: number;
      inconclusive: number;
      missing: number;
    }
  > = {};
  for (const sample of samples)
    for (const [id, expected] of Object.entries(sample.expected)) {
      const counts = (dimensions[id] ??= {
        samples: 0,
        judged: 0,
        agreement: 0,
        falsePass: 0,
        falseFail: 0,
        inconclusive: 0,
        missing: 0,
      });
      counts.samples += 1;
      const predicted = sample.evaluation.dimensions.find(
        (dimension) => dimension.dimensionId === id,
      );
      if (sample.evaluation.evaluatorStatus !== "valid" || !predicted) {
        counts.missing += 1;
        continue;
      }
      counts.judged += 1;
      if (predicted.status === expected) counts.agreement += 1;
      if (expected === "fail" && predicted.status === "pass") counts.falsePass += 1;
      if (expected === "pass" && predicted.status === "fail") counts.falseFail += 1;
      if (predicted.status === "insufficient_evidence") counts.inconclusive += 1;
    }
  return dimensions;
}

/** CLI entry only: no provider request is possible without the explicit enable flag and config. */
export async function runSemanticCommand(
  options: SemanticRunOptions,
  acceptedDatasetHashes: string[],
): Promise<number> {
  if (!options.out || !options.judgeConfig || options.allowJudgeRequests !== true)
    throw new Error("Semantic execution requires --out, --judge-config and --allow-judge-requests");
  const rawRegistry = readFileSync(resolve(__dirname, "semantic-cases.v1.json"), "utf8");
  const registry = JSON.parse(rawRegistry) as SemanticRegistry;
  validateSemanticRegistry(registry);
  const config = JSON.parse(readFileSync(options.judgeConfig, "utf8")) as SemanticProviderConfig;
  let capture: CaptureReport | undefined;
  let captureSha256: string | undefined;
  if (options.mode === "evaluate") {
    if (!options.capture) throw new Error("Captured-output evaluation requires --capture");
    const rawCapture = readFileSync(options.capture, "utf8");
    capture = validateCaptureReport(JSON.parse(rawCapture), acceptedDatasetHashes);
    captureSha256 = sha256(rawCapture);
  }
  const selected = registry.cases.filter((item) => {
    if (options.cases?.length) return options.cases.includes(item.caseId);
    return options.mode === "calibrate" || capture?.selection.includes(item.caseId);
  });
  if (!selected.length || options.cases?.some((id) => !selected.some((item) => item.caseId === id)))
    throw new Error("No semantic cases selected or unknown semantic case ID");
  const { provider, metadata } = createSemanticProvider(config);
  let judgeRequestsAttempted = 0;
  const countedProvider: typeof provider = async (request) => {
    judgeRequestsAttempted += 1;
    return provider(request);
  };
  const results: Array<{
    caseId: string;
    candidateId?: string;
    evaluation: SemanticEvaluation;
    expectedAgreement?: boolean;
    expectedDimensions?: Record<string, SemanticStatus>;
  }> = [];
  for (const item of selected) {
    if (options.mode === "calibrate") {
      for (const candidate of item.calibrationCandidates) {
        const records: EvidenceRecord[] = [
          { id: "input:scenario", kind: "input", text: item.scenario },
          { id: "input:role", kind: "input", text: item.roleInstructions },
          ...item.sourceDocuments.map((source) => ({
            id: `source:${source.id}`,
            kind: "source" as const,
            text: source.text,
          })),
          { id: "candidate:calibration", kind: "candidate", text: candidate.candidate },
        ];
        const evaluation = await evaluateSemantic(item, records, countedProvider);
        results.push({
          caseId: item.caseId,
          candidateId: candidate.id,
          expectedDimensions: candidate.expected,
          evaluation,
          expectedAgreement:
            evaluation.evaluatorStatus === "valid" &&
            evaluation.dimensions.every(
              (dimension) => candidate.expected[dimension.dimensionId] === dimension.status,
            ),
        });
      }
    } else {
      const result = capture?.results.find((candidate) => candidate.caseId === item.caseId);
      if (!result) throw new Error("Selected semantic case was not captured");
      const workflow = { ...result.checks };
      if (result.status === "failed") workflow.capturedRunSucceeded = false;
      results.push({
        caseId: item.caseId,
        evaluation: await evaluateSemantic(
          item,
          evidenceForCapture(item, result),
          countedProvider,
          workflow,
        ),
      });
    }
  }
  // Missing adapters remain visible: selection is not quietly narrowed to easy semantic cases.
  const unsupportedCapturedCaseIds =
    options.mode === "evaluate"
      ? (options.cases ?? capture?.selection ?? []).filter(
          (id) => !selected.some((item) => item.caseId === id),
        )
      : [];
  const evaluatorErrors = results.filter(
    (result) => result.evaluation.evaluatorStatus !== "valid",
  ).length;
  const failed = results.filter((result) => result.evaluation.verdict === "fail").length;
  const insufficient = results.filter(
    (result) => result.evaluation.verdict === "insufficient_evidence",
  ).length;
  const calibrationDisagreements = results.filter(
    (result) => result.expectedAgreement === false,
  ).length;
  let exitCode = 0;
  if (
    evaluatorErrors ||
    (options.mode !== "calibrate" && failed) ||
    calibrationDisagreements ||
    unsupportedCapturedCaseIds.length
  )
    exitCode = 1;
  else if (insufficient) exitCode = 2;
  const summary = {
    total: results.length,
    judgeRequestsAttempted,
    actualJudgedRuns: results.filter((result) => result.evaluation.evaluatorStatus === "valid")
      .length,
    calibrationDimensions: summarizeCalibration(
      results
        .filter((result) => result.expectedDimensions)
        .map((result) => ({
          expected: result.expectedDimensions ?? {},
          evaluation: result.evaluation,
        })),
    ),
    evaluatorErrors,
    failed,
    insufficient,
    calibrationDisagreements,
    unsupportedCapturedCaseIds,
    exitCode,
  };
  writeFileSync(
    options.out,
    `${JSON.stringify(
      {
        purpose:
          options.mode === "calibrate"
            ? "evaluator_calibration_only_not_application_execution"
            : "captured_application_evaluation",
        createdAt: new Date().toISOString(),
        calibration: "uncalibrated",
        expectationReview: registry.reviewStatus,
        evaluatorVersion: EVALUATOR_VERSION,
        evaluatorPromptTemplateSha256: sha256(EVALUATOR_SYSTEM),
        evaluatorRunnerCommit: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        registrySha256: sha256(rawRegistry),
        captureSha256,
        captureRunnerCommit: capture?.runnerCommit,
        judge: metadata,
        summary,
        results,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return exitCode;
}
