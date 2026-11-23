import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { VIEW_SCAN_ATTACHMENT } from "./wcag-audit.types";
import { buildWcagAuditSummary, renderWcagAuditMarkdown } from "./wcag-report";

import type { ViewScan } from "./wcag-audit.types";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

type WcagAuditReporterOptions = {
  outputDir?: string;
};

/**
 * Collects the scans attached by `scanView` and writes `wcag-report.md` / `wcag-report.json`.
 * It never changes the run status: only views scanned with `regressionCheck` fail tests.
 */
export default class WcagAuditReporter implements Reporter {
  private readonly scansByTest = new Map<string, ViewScan[]>();
  private readonly outputDir: string;

  constructor({ outputDir }: WcagAuditReporterOptions = {}) {
    this.outputDir = path.resolve(outputDir ?? "a11y-report");
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Keep only the last attempt so a retried test is not counted twice.
    const scans = result.attachments
      .filter(({ name, body }) => name === VIEW_SCAN_ATTACHMENT && body)
      .map(({ body }) => JSON.parse(String(body)) as ViewScan);
    this.scansByTest.set(test.id, scans);
  }

  onEnd() {
    const scans = [...this.scansByTest.values()].flat();
    if (!scans.length) return;

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
  }
}
