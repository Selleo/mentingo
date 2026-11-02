import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { runJudgeCase, summarize, validateDataset } from "./evaluation";
import { runHttpCase, validateHttpConfig } from "./http-adapter";
import { runSemanticCommand } from "./run-semantic";
import { validateSemanticRegistry } from "./semantic-evaluator";

import type { CaseResult, HttpRunConfig, RegressionDataset } from "./evaluation.types";
import type { SemanticRegistry } from "./semantic-evaluator.types";

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "offline" },
      out: { type: "string" },
      config: { type: "string" },
      case: { type: "string", multiple: true },
      "allow-app-requests": { type: "boolean", default: false },
      capture: { type: "string" },
      "judge-config": { type: "string" },
      "allow-judge-requests": { type: "boolean", default: false },
    },
  });
  if (!["offline", "http", "validate", "evaluate", "calibrate"].includes(String(values.mode)))
    throw new Error("Unknown mode");
  const baseRaw = readFileSync(resolve(__dirname, "dataset.v1.json"), "utf8");
  const assessmentRaw = readFileSync(resolve(__dirname, "assessment-cases.v1.json"), "utf8");
  const baseDataset = JSON.parse(baseRaw) as RegressionDataset;
  const assessmentDataset = JSON.parse(assessmentRaw) as RegressionDataset;
  validateDataset(baseDataset);
  validateDataset(assessmentDataset);
  const raw = baseRaw + "\n" + assessmentRaw;
  const dataset: RegressionDataset = {
    version: 1,
    name: "mentingo-core-ai-regression-catalogue",
    cases: [...baseDataset.cases, ...assessmentDataset.cases],
  };
  validateDataset(dataset);
  validateSemanticRegistry(
    JSON.parse(
      readFileSync(resolve(__dirname, "semantic-cases.v1.json"), "utf8"),
    ) as SemanticRegistry,
  );
  if (values.mode === "evaluate" || values.mode === "calibrate") {
    process.exitCode = await runSemanticCommand(
      {
        mode: values.mode,
        out: values.out,
        capture: values.capture,
        judgeConfig: values["judge-config"],
        allowJudgeRequests: values["allow-judge-requests"],
        cases: values.case,
      },
      [
        createHash("sha256").update(baseRaw).digest("hex"),
        createHash("sha256").update(raw).digest("hex"),
      ],
    );
    return;
  }
  if (values.mode === "validate") {
    process.stdout.write(
      `Valid catalogue: ${dataset.cases.length} cases; semantic review remains pending.\n`,
    );
    return;
  }
  if (!values.out) throw new Error("An explicit local --out path is required");
  const selected = dataset.cases.filter((item) => {
    if (values.case?.length) return values.case.includes(item.id);
    return values.mode === "offline" ? item.execution === "judge" : item.execution !== "judge";
  });
  if (!selected.length || values.case?.some((id) => !selected.some((item) => item.id === id)))
    throw new Error("No cases selected or unknown case ID");
  let config: HttpRunConfig | undefined;
  if (values.mode === "http") {
    if (!values["allow-app-requests"] || !values.config)
      throw new Error("HTTP mode requires --allow-app-requests and an explicit --config path");
    config = JSON.parse(readFileSync(values.config, "utf8")) as HttpRunConfig;
    validateHttpConfig(config);
  }
  const results: CaseResult[] = [];
  for (const item of selected) {
    if (values.mode === "offline" && item.execution === "judge") results.push(runJudgeCase(item));
    else if (config && ["mentor", "search", "authoring", "assessment"].includes(item.execution)) {
      try {
        results.push(await runHttpCase(item, config));
      } catch {
        // Provider/application bodies and thrown objects may include credentials or internal errors.
        results.push({
          caseId: item.id,
          status: "failed",
          checks: {},
          evidence: {},
          reason:
            "Application run failed: check fixture preparation, authorization, terminal state and timeout locally.",
        });
      }
    } else
      results.push({
        caseId: item.id,
        status: "not_run",
        checks: {},
        evidence: {},
        reason: "No adapter for this case in the selected mode",
      });
  }
  const summary = summarize(results);
  writeFileSync(
    values.out,
    `${JSON.stringify(
      {
        dataset: dataset.name,
        datasetVersion: dataset.version,
        datasetSha256: createHash("sha256").update(raw).digest("hex"),
        runnerCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        nodeVersion: process.version,
        mode: values.mode,
        createdAt: new Date().toISOString(),
        selection: selected.map((item) => item.id),
        catalogueCaseCount: dataset.cases.length,
        semanticCalibration: "pending_domain_review",
        summary,
        results,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exitCode = summary.exitCode;
}

main().catch(() => {
  console.error(
    "Evaluation setup failed. Check arguments, dataset and local fixture configuration; no credentials were printed.",
  );
  process.exitCode = 1;
});
