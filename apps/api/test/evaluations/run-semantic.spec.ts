import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { runSemanticCommand, summarizeCalibration } from "./run-semantic";
import { createSemanticProvider } from "./semantic-provider";

import type {
  EvidenceRecord,
  SemanticDimension,
  SemanticEvaluation,
  SemanticStatus,
} from "./semantic-evaluator.types";

jest.mock("./semantic-provider", () => ({ createSemanticProvider: jest.fn() }));

describe("semantic CLI orchestration with a deliberately indiscriminate fake judge", () => {
  let directory: string;
  const allPassProvider = jest.fn(async ({ prompt }: { system: string; prompt: string }) => {
    const data = JSON.parse(prompt) as {
      dimensionDefinitions: SemanticDimension[];
      evidenceRecords: EvidenceRecord[];
    };
    const candidate = data.evidenceRecords.find((record) => record.kind === "candidate");
    const source = data.evidenceRecords.find((record) => record.kind === "source");
    if (!candidate || !source) throw new Error("Mock needs candidate and source");
    return JSON.stringify({
      dimensions: data.dimensionDefinitions.map((dimension) => ({
        dimensionId: dimension.id,
        status: "pass",
        reason: "Intentionally indiscriminate fake judge used to test failure accounting.",
        evidence: [
          { recordId: candidate.id, quote: candidate.text.slice(0, 100) },
          ...(dimension.id === "source_grounding"
            ? [{ recordId: source.id, quote: source.text.slice(0, 100) }]
            : []),
        ],
      })),
    });
  });

  beforeEach(() => {
    jest.spyOn(process.stdout, "write").mockReturnValue(true);
    directory = mkdtempSync(resolve(tmpdir(), "core-semantic-cli-test-"));
    writeFileSync(
      resolve(directory, "judge.json"),
      JSON.stringify({ model: "fake-judge", apiKeyEnv: "UNUSED" }),
    );
    (createSemanticProvider as jest.Mock).mockReturnValue({
      provider: allPassProvider,
      metadata: { model: "fake-judge", configSha256: "mock-config" },
    });
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("separates false passes, false failures, inconclusive and missing evaluations", () => {
    const evaluation = (status: SemanticStatus, valid = true): SemanticEvaluation => ({
      evaluatorVersion: "test",
      promptSha256: "test",
      evidenceSha256: "test",
      calibration: "uncalibrated",
      evaluatorStatus: valid ? "valid" : "invalid_output",
      verdict: status,
      dimensions: [{ dimensionId: "source_grounding", status, reason: "test", evidence: [] }],
    });
    expect(
      summarizeCalibration([
        { expected: { source_grounding: "fail" }, evaluation: evaluation("pass") },
        { expected: { source_grounding: "pass" }, evaluation: evaluation("fail") },
        { expected: { source_grounding: "pass" }, evaluation: evaluation("insufficient_evidence") },
        { expected: { source_grounding: "fail" }, evaluation: evaluation("fail", false) },
        { expected: { source_grounding: "pass" }, evaluation: evaluation("pass") },
      ]),
    ).toEqual({
      source_grounding: {
        samples: 5,
        judged: 4,
        agreement: 1,
        falsePass: 1,
        falseFail: 1,
        inconclusive: 1,
        missing: 1,
      },
    });
  });

  it("cannot make provider requests without explicit opt-in", async () => {
    await expect(
      runSemanticCommand(
        {
          mode: "calibrate",
          out: resolve(directory, "out.json"),
          judgeConfig: resolve(directory, "judge.json"),
        },
        [],
      ),
    ).rejects.toThrow("allow-judge-requests");
    expect(createSemanticProvider).not.toHaveBeenCalled();
  });

  it("fails calibration when an all-pass judge approves adversarial negatives", async () => {
    const exitCode = await runSemanticCommand(
      {
        mode: "calibrate",
        out: resolve(directory, "out.json"),
        judgeConfig: resolve(directory, "judge.json"),
        allowJudgeRequests: true,
      },
      [],
    );
    const report = JSON.parse(readFileSync(resolve(directory, "out.json"), "utf8"));
    expect(exitCode).toBe(1);
    expect(report.summary.calibrationDisagreements).toBeGreaterThan(0);
    expect(report.summary.judgeRequestsAttempted).toBe(16);
    expect(report.summary.actualJudgedRuns).toBe(16);
    expect(report.summary.calibrationDimensions.task_fulfillment.falsePass).toBeGreaterThan(0);
    expect(report.purpose).toBe("evaluator_calibration_only_not_application_execution");
    expect(report.expectationReview).toBe("developer_authored_not_human_gold");
    expect(report.calibration).toBe("uncalibrated");
  });

  it("does not let a passing semantic judge override failed native application evidence", async () => {
    const caseId = "mentor-teacher-multi-turn";
    writeFileSync(
      resolve(directory, "capture.json"),
      JSON.stringify({
        mode: "http",
        datasetSha256: "expected-digest",
        runnerCommit: "a".repeat(40),
        createdAt: "2026-11-02T10:00:00Z",
        selection: [caseId],
        results: [
          {
            caseId,
            status: "failed",
            checks: { userTurnsPersisted: true, assistantTurnsPersisted: false },
            evidence: {
              messages: [
                { role: "assistant", content: "Reception issues the badge free of charge." },
              ],
            },
          },
        ],
      }),
    );
    const exitCode = await runSemanticCommand(
      {
        mode: "evaluate",
        out: resolve(directory, "out.json"),
        capture: resolve(directory, "capture.json"),
        judgeConfig: resolve(directory, "judge.json"),
        allowJudgeRequests: true,
      },
      ["expected-digest"],
    );
    const report = JSON.parse(readFileSync(resolve(directory, "out.json"), "utf8"));
    expect(exitCode).toBe(1);
    expect(report.results[0].evaluation.verdict).toBe("fail");
    expect(
      report.results[0].evaluation.dimensions.find(
        (dimension: any) => dimension.dimensionId === "source_grounding",
      ).status,
    ).toBe("pass");
    expect(
      report.results[0].evaluation.dimensions.find(
        (dimension: any) => dimension.dimensionId === "workflow_completion",
      ).status,
    ).toBe("fail");
  });
});
