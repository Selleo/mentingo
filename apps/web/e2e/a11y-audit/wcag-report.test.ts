import { CUSTOM_RULE } from "./custom-checks";
import { AUDIT_ENGINE, AUDIT_IMPACT, AUDIT_OUTCOME, AUDIT_ROLE } from "./wcag-audit.types";
import {
  buildWcagAuditSummary,
  compareWithBaseline,
  CRITERION_STATUS,
  renderWcagAuditMarkdown,
} from "./wcag-report";
import { criterionIdFromAxeTag, WCAG21_AA_CRITERIA } from "./wcag21-criteria";

import type { AuditRuleResult, ViewScan } from "./wcag-audit.types";

const rule = (overrides: Partial<AuditRuleResult>): AuditRuleResult => ({
  ruleId: "color-contrast",
  engine: AUDIT_ENGINE.AXE,
  outcome: AUDIT_OUTCOME.PASS,
  criteria: ["1.4.3"],
  tags: ["wcag2aa", "wcag143"],
  impact: null,
  help: "Elements must meet minimum color contrast ratio thresholds",
  nodes: [],
  ...overrides,
});

const scan = (overrides: Partial<ViewScan>): ViewScan => ({
  viewId: "login",
  viewName: "Login",
  role: AUDIT_ROLE.ANONYMOUS,
  path: "/auth/login",
  title: "Login – Mentingo",
  axeVersion: "4.14.1",
  rules: [],
  ...overrides,
});

const statusOf = (summary: ReturnType<typeof buildWcagAuditSummary>, criterionId: string) =>
  summary.criteria.find(({ id }) => id === criterionId)?.status;

describe("WCAG audit report", () => {
  it("covers the 50 WCAG 2.1 A/AA success criteria", () => {
    expect(WCAG21_AA_CRITERIA).toHaveLength(50);
    expect(WCAG21_AA_CRITERIA.filter(({ level }) => level === "A")).toHaveLength(30);
  });

  it.each([
    { tag: "wcag143", criterion: "1.4.3" },
    { tag: "wcag1410", criterion: "1.4.10" },
    { tag: "wcag412", criterion: "4.1.2" },
    { tag: "wcag21aa", criterion: null },
    { tag: "best-practice", criterion: null },
  ])("maps axe tag $tag to criterion $criterion", ({ tag, criterion }) => {
    expect(criterionIdFromAxeTag(tag)).toBe(criterion);
  });

  it("does not count a criterion without automated failures as met unless automation decides it", () => {
    const summary = buildWcagAuditSummary([
      scan({
        rules: [
          rule({}),
          rule({ ruleId: "html-has-lang", criteria: ["3.1.1"], tags: ["wcag2a", "wcag311"] }),
        ],
      }),
    ]);

    expect(statusOf(summary, "1.4.3")).toBe(CRITERION_STATUS.NO_AUTOMATED_FAILURES);
    expect(statusOf(summary, "3.1.1")).toBe(CRITERION_STATUS.MET);
    expect(statusOf(summary, "4.1.1")).toBe(CRITERION_STATUS.MET);
    expect(statusOf(summary, "1.2.1")).toBe(CRITERION_STATUS.NOT_VERIFIED);
  });

  it("scores failed, met and unverifiable criteria separately", () => {
    const summary = buildWcagAuditSummary([
      scan({
        rules: [
          rule({
            outcome: AUDIT_OUTCOME.VIOLATION,
            impact: AUDIT_IMPACT.SERIOUS,
            nodes: [{ target: ".hint", html: "<p class='hint'>" }],
          }),
          rule({ ruleId: "html-has-lang", criteria: ["3.1.1"], tags: ["wcag311"] }),
          rule({ ruleId: "label", criteria: ["4.1.2"], outcome: AUDIT_OUTCOME.NEEDS_REVIEW }),
        ],
      }),
    ]);

    expect(summary.verdict).toBe("not-conformant");
    expect(summary.score).toMatchObject({
      totalCriteria: 50,
      // 3.1.1 (decisive pass), 4.1.1 (errata), 2.4.2 (unique title check passed).
      met: 3,
      failed: 1,
      notVerifiable: 46,
      automatedEstimatePercent: 75,
      lowerBoundPercent: 6,
      upperBoundPercent: 98,
    });
    expect(summary.violations.byImpact.occurrences.serious).toBe(1);
  });

  it("flags the same title on different pages but not on states of one page", () => {
    const summary = buildWcagAuditSummary([
      scan({ viewId: "login", title: "Mentingo" }),
      scan({ viewId: "login-errors", title: "Mentingo" }),
      scan({ viewId: "courses", path: "/courses", title: "Mentingo" }),
      scan({ viewId: "register", path: "/auth/register", title: "Register – Mentingo" }),
    ]);

    const duplicateTitleViews = summary.violations.findings
      .filter(({ ruleId }) => ruleId === CUSTOM_RULE.PAGE_TITLE_UNIQUE)
      .map(({ viewId }) => viewId);
    expect(duplicateTitleViews).toEqual(["login", "login-errors", "courses"]);
  });

  it("does not compare titles across roles", () => {
    const summary = buildWcagAuditSummary([
      scan({ viewId: "student-courses", path: "/courses", title: "Courses – Mentingo" }),
      scan({
        viewId: "admin-courses",
        role: AUDIT_ROLE.ADMIN,
        path: "/admin/courses",
        title: "Courses – Mentingo",
      }),
    ]);

    expect(summary.violations.findings).toEqual([]);
  });

  it("keeps WCAG 2.2 and best-practice violations out of the score", () => {
    const summary = buildWcagAuditSummary([
      scan({
        rules: [
          rule({
            ruleId: "target-size",
            criteria: ["2.5.8"],
            outcome: AUDIT_OUTCOME.VIOLATION,
            impact: AUDIT_IMPACT.SERIOUS,
          }),
        ],
      }),
    ]);

    expect(summary.score.failed).toBe(0);
    expect(summary.otherViolations.map(({ ruleId }) => ruleId)).toEqual(["target-size"]);
  });

  it("reports violations missing from the baseline as new and missing ones as resolved", () => {
    const summary = buildWcagAuditSummary([
      scan({
        rules: [rule({ outcome: AUDIT_OUTCOME.VIOLATION, impact: AUDIT_IMPACT.SERIOUS })],
      }),
    ]);

    expect(compareWithBaseline(summary, ["login::label"])).toEqual({
      newFindings: ["login::color-contrast"],
      resolvedFindings: ["login::label"],
    });
  });

  it("renders the score and the location of each violation", () => {
    const markdown = renderWcagAuditMarkdown(
      buildWcagAuditSummary([
        scan({
          rules: [
            rule({
              outcome: AUDIT_OUTCOME.VIOLATION,
              impact: AUDIT_IMPACT.SERIOUS,
              nodes: [{ target: '[data-testid="login-hint"]', html: "<p>" }],
            }),
          ],
        }),
      ]),
    );

    expect(markdown).toContain("not conformant");
    expect(markdown).toContain('`[data-testid="login-hint"]`');
  });
});
