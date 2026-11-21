import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { VIEW_SCAN_ATTACHMENT } from "./wcag-audit.types";
import {
  buildWcagAuditSummary,
  compareWithBaseline,
  findingKeys,
  renderWcagAuditMarkdown,
} from "./wcag-report";

import type { ViewScan } from "./wcag-audit.types";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

type WcagAuditReporterOptions = {
  outputDir?: string;
  baselineFile?: string;
};

/**
 * Collects the scans attached by `scanView`, writes `wcag-report.md` / `wcag-report.json`, and
 * fails the run when a violation appears that the baseline does not list.
 *
 * Env: `A11Y_UPDATE_BASELINE=true` rewrites the baseline from this run;
 * `A11Y_ENFORCE_BASELINE=false` reports new violations without failing.
 */
export default class WcagAuditReporter implements Reporter {
  private readonly scansByTest = new Map<string, ViewScan[]>();
  private readonly outputDir: string;
  private readonly baselineFile: string;

  constructor({ outputDir, baselineFile }: WcagAuditReporterOptions = {}) {
    this.outputDir = path.resolve(outputDir ?? "a11y-report");
    this.baselineFile = path.resolve(baselineFile ?? "e2e/a11y-audit/wcag-baseline.json");
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Keep only the last attempt so a retried test is not counted twice.
    const scans = result.attachments
      .filter(({ name, body }) => name === VIEW_SCAN_ATTACHMENT && body)
      .map(({ body }) => JSON.parse(String(body)) as ViewScan);
    this.scansByTest.set(test.id, scans);
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult["status"] } | undefined> {
    const scans = [...this.scansByTest.values()].flat();
    if (!scans.length) return undefined;

    const summary = buildWcagAuditSummary(scans);
    const markdown = renderWcagAuditMarkdown(summary);
    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(path.join(this.outputDir, "wcag-report.json"), JSON.stringify(summary, null, 2));
    writeFileSync(path.join(this.outputDir, "wcag-report.md"), markdown);
    writeFileSync(path.join(this.outputDir, "wcag-scans.json"), JSON.stringify(scans, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);

    const { score, violations } = summary;
    console.log(
      [
        "",
        `WCAG 2.1 AA audit: ${summary.views.length} views, ${score.failed}/${score.totalCriteria} criteria failed, estimate ${score.automatedEstimatePercent}% (range ${score.lowerBoundPercent}–${score.upperBoundPercent}%)`,
        `Violations: ${violations.rules.length} rules, ${violations.findings.length} findings, ${violations.totalOccurrences} occurrences (critical ${violations.byImpact.occurrences.critical}, serious ${violations.byImpact.occurrences.serious}, moderate ${violations.byImpact.occurrences.moderate}, minor ${violations.byImpact.occurrences.minor})`,
        `Report: ${path.join(this.outputDir, "wcag-report.md")}`,
      ].join("\n"),
    );

    if (process.env.A11Y_UPDATE_BASELINE === "true") {
      writeFileSync(this.baselineFile, `${JSON.stringify(findingKeys(summary), null, 2)}\n`);
      console.log(`Baseline updated: ${this.baselineFile}`);
      return undefined;
    }

    // A partial run (one test, a failed test) only proves what it scanned.
    if (result.status !== "passed") return undefined;

    const baseline: string[] = existsSync(this.baselineFile)
      ? JSON.parse(readFileSync(this.baselineFile, "utf8"))
      : [];
    const { newFindings, resolvedFindings } = compareWithBaseline(summary, baseline);
    if (resolvedFindings.length) {
      console.log(
        `Fixed since the baseline (remove them with A11Y_UPDATE_BASELINE=true):\n  ${resolvedFindings.join("\n  ")}`,
      );
    }
    if (!newFindings.length) return undefined;

    console.error(`New WCAG violations not in the baseline:\n  ${newFindings.join("\n  ")}`);
    return process.env.A11Y_ENFORCE_BASELINE === "false" ? undefined : { status: "failed" };
  }
}
