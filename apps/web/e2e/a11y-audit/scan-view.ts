import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  expectNoAxeViolations,
  scanPageWithAxe,
  type AxeRegressionCheckOptions,
  type AxeRuleResult,
} from "../utils/axe-scan";

import {
  checkKeyboardNavigation,
  checkPageTitle,
  checkPointerOnlyControls,
  checkReflow,
  checkTextSpacing,
} from "./custom-checks";
import { AUDIT_ENGINE, AUDIT_OUTCOME, VIEW_SCAN_ATTACHMENT } from "./wcag-audit.types";
import { AUDIT_AXE_TAGS, criterionIdFromAxeTag } from "./wcag21-criteria";

import type {
  AuditImpact,
  AuditOutcome,
  AuditRole,
  AuditRuleResult,
  ViewScan,
} from "./wcag-audit.types";

const MAX_REPORTED_NODES = 50;

type ScanViewOptions = {
  viewId: string;
  viewName: string;
  role: AuditRole;
  /**
   * Run the Tab walk, 320 px reflow and text-spacing checks. Turn off for transient states
   * (open menus, dialogs) that a resize or Tab press would close.
   */
  layoutAndKeyboardChecks?: boolean;
  /**
   * Also fail the test on any axe WCAG violation in this view, like the E2E accessibility specs.
   * Turn on for views that are clean, so they stay clean; other views are only reported.
   */
  regressionCheck?: AxeRegressionCheckOptions;
};

const toAuditRuleResult = (result: AxeRuleResult, outcome: AuditOutcome): AuditRuleResult => ({
  ruleId: result.id,
  engine: AUDIT_ENGINE.AXE,
  outcome,
  criteria: result.tags.flatMap((tag) => criterionIdFromAxeTag(tag) ?? []),
  tags: result.tags,
  impact: (result.impact ?? null) as AuditImpact | null,
  help: result.help,
  helpUrl: result.helpUrl,
  nodes:
    outcome === AUDIT_OUTCOME.VIOLATION || outcome === AUDIT_OUTCOME.NEEDS_REVIEW
      ? result.nodes.slice(0, MAX_REPORTED_NODES).map(({ target, html, failureSummary }) => ({
          target: target.flat().join(" >>> "),
          html: html.slice(0, 300),
          summary: failureSummary,
        }))
      : [],
});

/**
 * Audits the current page state against WCAG 2.1 A/AA and attaches the result for the WCAG audit
 * reporter, which scores it. Findings fail the test only with `regressionCheck`.
 * Callers MUST wait for the view's content first.
 */
export const scanView = async (
  page: Page,
  { viewId, viewName, role, layoutAndKeyboardChecks = true, regressionCheck }: ScanViewOptions,
) => {
  // Scan settled colors: menus and dialogs fade in even with reduced motion.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => animation)),
    ),
  );
  const axeResults = await scanPageWithAxe(page, { tags: AUDIT_AXE_TAGS });
  if (regressionCheck) expectNoAxeViolations(page, axeResults, regressionCheck);

  const { title, result: titleResult } = await checkPageTitle(page);
  const customResults: AuditRuleResult[] = [titleResult];
  if (layoutAndKeyboardChecks) {
    customResults.push(await checkPointerOnlyControls(page));
    customResults.push(...(await checkKeyboardNavigation(page)));
    customResults.push(await checkTextSpacing(page));
    customResults.push(...(await checkReflow(page)));
  }

  const scan: ViewScan = {
    viewId,
    viewName,
    role,
    path: new URL(page.url()).pathname,
    title,
    axeVersion: axeResults.testEngine.version,
    rules: [
      ...axeResults.violations.map((result) => toAuditRuleResult(result, AUDIT_OUTCOME.VIOLATION)),
      ...axeResults.incomplete.map((result) =>
        toAuditRuleResult(result, AUDIT_OUTCOME.NEEDS_REVIEW),
      ),
      ...axeResults.passes.map((result) => toAuditRuleResult(result, AUDIT_OUTCOME.PASS)),
      ...axeResults.inapplicable.map((result) =>
        toAuditRuleResult(result, AUDIT_OUTCOME.INAPPLICABLE),
      ),
      ...customResults,
    ],
  };

  await test.info().attach(VIEW_SCAN_ATTACHMENT, {
    body: JSON.stringify(scan),
    contentType: "application/json",
  });
};

export type AuditedView = Omit<ScanViewOptions, "role" | "layoutAndKeyboardChecks"> & {
  path: string;
  /** Locator of an element that only renders once the view has its content. */
  ready: (page: Page) => Locator;
};

/** Opens a view by URL, waits for its content, then scans it. */
export const openAndScanView = async (page: Page, role: AuditRole, view: AuditedView) => {
  await page.goto(view.path);
  await expect(view.ready(page).first()).toBeVisible();
  await scanView(page, {
    viewId: view.viewId,
    viewName: view.viewName,
    role,
    regressionCheck: view.regressionCheck,
  });
};
