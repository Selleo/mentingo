import { match } from "ts-pattern";

import { CUSTOM_RULE } from "./custom-checks";
import { AUDIT_ENGINE, AUDIT_IMPACT, AUDIT_OUTCOME } from "./wcag-audit.types";
import { AUTOMATION_LEVEL, WCAG21_AA_CRITERIA } from "./wcag21-criteria";

import type { AuditImpact, AuditNode, AuditRuleResult, ViewScan } from "./wcag-audit.types";
import type { WcagCriterion } from "./wcag21-criteria";

export const CRITERION_STATUS = {
  FAILED: "failed",
  MET: "met",
  NO_AUTOMATED_FAILURES: "no-automated-failures",
  NEEDS_REVIEW: "needs-review",
  NOT_VERIFIED: "not-verified",
} as const;

export type CriterionStatus = (typeof CRITERION_STATUS)[keyof typeof CRITERION_STATUS];

export type CriterionAssessment = WcagCriterion & {
  status: CriterionStatus;
  violatedRules: string[];
  reviewRules: string[];
  passedRules: string[];
};

export type Finding = {
  viewId: string;
  viewName: string;
  path: string;
  ruleId: string;
  engine: AuditRuleResult["engine"];
  impact: AuditImpact;
  criteria: string[];
  help: string;
  helpUrl?: string;
  nodes: AuditNode[];
};

export type RuleSummary = {
  ruleId: string;
  engine: AuditRuleResult["engine"];
  impact: AuditImpact;
  criteria: string[];
  help: string;
  helpUrl?: string;
  views: string[];
  occurrences: number;
  uniqueElements: number;
};

export type ImpactCounts = Record<AuditImpact, number>;

export type WcagAuditSummary = {
  generatedAt: string;
  axeVersion: string;
  views: { viewId: string; viewName: string; role: string; path: string; title: string }[];
  verdict: "conformant" | "not-conformant";
  score: {
    totalCriteria: number;
    met: number;
    failed: number;
    notVerifiable: number;
    /** met / (met + failed): conformance among the criteria automation could assess. */
    automatedEstimatePercent: number;
    /** Every unverified criterion assumed to fail. */
    lowerBoundPercent: number;
    /** Every unverified criterion assumed to pass. */
    upperBoundPercent: number;
    automatedCoveragePercent: number;
  };
  criteria: CriterionAssessment[];
  violations: {
    /** WCAG 2.1 A/AA findings: one per rule per view. */
    findings: Finding[];
    rules: RuleSummary[];
    byImpact: { rules: ImpactCounts; findings: ImpactCounts; occurrences: ImpactCounts };
    totalOccurrences: number;
    uniqueElements: number;
  };
  /** Violations outside WCAG 2.1 A/AA: WCAG 2.2 AA and axe best practices. */
  otherViolations: RuleSummary[];
  needsReview: RuleSummary[];
};

const IMPACT_ORDER: AuditImpact[] = [
  AUDIT_IMPACT.CRITICAL,
  AUDIT_IMPACT.SERIOUS,
  AUDIT_IMPACT.MODERATE,
  AUDIT_IMPACT.MINOR,
];

const emptyImpactCounts = (): ImpactCounts => ({ critical: 0, serious: 0, moderate: 0, minor: 0 });

const WCAG21_AA_CRITERION_IDS = new Set(WCAG21_AA_CRITERIA.map(({ id }) => id));

const isWcag21AaRule = (rule: Pick<AuditRuleResult, "criteria">) =>
  rule.criteria.some((criterion) => WCAG21_AA_CRITERION_IDS.has(criterion));

const toPercent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

/**
 * Adds the cross-view check: different pages a user of one role visits must not share one
 * <title>. States of one page (same path) may share it.
 */
export const addDuplicateTitleFindings = (scans: ViewScan[]): ViewScan[] => {
  const titleKey = ({ role, title }: ViewScan) => `${role}::${title}`;
  const pathsByTitle = new Map<string, Set<string>>();
  scans.forEach((scan) => {
    if (!scan.title) return;
    const paths = pathsByTitle.get(titleKey(scan)) ?? new Set<string>();
    paths.add(scan.path);
    pathsByTitle.set(titleKey(scan), paths);
  });

  return scans.map((scan) => {
    const pathsWithSameTitle = pathsByTitle.get(titleKey(scan))?.size ?? 0;
    const isDuplicated = pathsWithSameTitle > 1;
    const result: AuditRuleResult = {
      ruleId: CUSTOM_RULE.PAGE_TITLE_UNIQUE,
      engine: AUDIT_ENGINE.MENTINGO,
      outcome: isDuplicated ? AUDIT_OUTCOME.VIOLATION : AUDIT_OUTCOME.PASS,
      criteria: ["2.4.2"],
      tags: ["wcag242"],
      impact: isDuplicated ? AUDIT_IMPACT.MODERATE : null,
      help: "Each page has a title that tells it apart from other pages",
      nodes: isDuplicated
        ? [
            {
              target: "title",
              html: `<title>${scan.title}</title>`,
              summary: `The same title is used on ${pathsWithSameTitle} different pages`,
            },
          ]
        : [],
    };
    return { ...scan, rules: [...scan.rules, result] };
  });
};

const assessCriterion = (criterion: WcagCriterion, scans: ViewScan[]): CriterionAssessment => {
  const rulesForCriterion = scans.flatMap(({ rules }) =>
    rules.filter(({ criteria }) => criteria.includes(criterion.id)),
  );
  const ruleIdsWith = (outcome: AuditRuleResult["outcome"]) =>
    [
      ...new Set(
        rulesForCriterion.filter((rule) => rule.outcome === outcome).map(({ ruleId }) => ruleId),
      ),
    ].sort();

  const violatedRules = ruleIdsWith(AUDIT_OUTCOME.VIOLATION);
  const reviewRules = ruleIdsWith(AUDIT_OUTCOME.NEEDS_REVIEW);
  const passedRules = ruleIdsWith(AUDIT_OUTCOME.PASS);

  const status = match({ criterion, violatedRules, reviewRules, passedRules })
    .returnType<CriterionStatus>()
    .when(
      ({ criterion: { alwaysSatisfied } }) => Boolean(alwaysSatisfied),
      () => CRITERION_STATUS.MET,
    )
    .when(
      ({ violatedRules: violated }) => violated.length > 0,
      () => CRITERION_STATUS.FAILED,
    )
    .when(
      ({ reviewRules: review }) => review.length > 0,
      () => CRITERION_STATUS.NEEDS_REVIEW,
    )
    .when(
      ({ passedRules: passed }) => passed.length > 0,
      ({ criterion: { automation } }) =>
        automation === AUTOMATION_LEVEL.DECISIVE
          ? CRITERION_STATUS.MET
          : CRITERION_STATUS.NO_AUTOMATED_FAILURES,
    )
    .otherwise(() => CRITERION_STATUS.NOT_VERIFIED);

  return { ...criterion, status, violatedRules, reviewRules, passedRules };
};

const summarizeRules = (
  scans: ViewScan[],
  outcome: AuditRuleResult["outcome"],
  isIncluded: (rule: AuditRuleResult) => boolean,
): RuleSummary[] => {
  const summaries = new Map<string, RuleSummary & { elementKeys: Set<string> }>();

  scans.forEach(({ viewId, rules }) => {
    rules
      .filter((rule) => rule.outcome === outcome && isIncluded(rule))
      .forEach((rule) => {
        const summary = summaries.get(rule.ruleId) ?? {
          ruleId: rule.ruleId,
          engine: rule.engine,
          impact: rule.impact ?? AUDIT_IMPACT.MINOR,
          criteria: rule.criteria,
          help: rule.help,
          helpUrl: rule.helpUrl,
          views: [],
          occurrences: 0,
          uniqueElements: 0,
          elementKeys: new Set<string>(),
        };
        summary.views.push(viewId);
        summary.occurrences += Math.max(rule.nodes.length, 1);
        rule.nodes.forEach(({ target }) => summary.elementKeys.add(target));
        summaries.set(rule.ruleId, summary);
      });
  });

  return [...summaries.values()]
    .map(({ elementKeys, ...summary }) => ({
      ...summary,
      uniqueElements: Math.max(elementKeys.size, 1),
    }))
    .sort(
      (first, second) =>
        IMPACT_ORDER.indexOf(first.impact) - IMPACT_ORDER.indexOf(second.impact) ||
        second.occurrences - first.occurrences,
    );
};

/** Scores the scans against the 50 WCAG 2.1 A/AA success criteria. */
export const buildWcagAuditSummary = (
  rawScans: ViewScan[],
  generatedAt = new Date().toISOString(),
): WcagAuditSummary => {
  const scans = addDuplicateTitleFindings(rawScans);
  const criteria = WCAG21_AA_CRITERIA.map((criterion) => assessCriterion(criterion, scans));
  const countWith = (...statuses: CriterionStatus[]) =>
    criteria.filter(({ status }) => statuses.includes(status)).length;

  const met = countWith(CRITERION_STATUS.MET, CRITERION_STATUS.NO_AUTOMATED_FAILURES);
  const failed = countWith(CRITERION_STATUS.FAILED);
  const notVerifiable = countWith(CRITERION_STATUS.NEEDS_REVIEW, CRITERION_STATUS.NOT_VERIFIED);
  const totalCriteria = criteria.length;

  const findings: Finding[] = scans.flatMap(({ viewId, viewName, path, rules }) =>
    rules
      .filter((rule) => rule.outcome === AUDIT_OUTCOME.VIOLATION && isWcag21AaRule(rule))
      .map((rule) => ({
        viewId,
        viewName,
        path,
        ruleId: rule.ruleId,
        engine: rule.engine,
        impact: rule.impact ?? AUDIT_IMPACT.MINOR,
        criteria: rule.criteria,
        help: rule.help,
        helpUrl: rule.helpUrl,
        nodes: rule.nodes,
      })),
  );
  const rules = summarizeRules(scans, AUDIT_OUTCOME.VIOLATION, isWcag21AaRule);

  const byImpact = {
    rules: emptyImpactCounts(),
    findings: emptyImpactCounts(),
    occurrences: emptyImpactCounts(),
  };
  rules.forEach(({ impact }) => (byImpact.rules[impact] += 1));
  findings.forEach(({ impact, nodes }) => {
    byImpact.findings[impact] += 1;
    byImpact.occurrences[impact] += Math.max(nodes.length, 1);
  });

  return {
    generatedAt,
    axeVersion: rawScans[0]?.axeVersion ?? "unknown",
    views: rawScans.map(({ viewId, viewName, role, path, title }) => ({
      viewId,
      viewName,
      role,
      path,
      title,
    })),
    verdict: failed > 0 ? "not-conformant" : "conformant",
    score: {
      totalCriteria,
      met,
      failed,
      notVerifiable,
      automatedEstimatePercent: toPercent(met, met + failed),
      lowerBoundPercent: toPercent(met, totalCriteria),
      upperBoundPercent: toPercent(met + notVerifiable, totalCriteria),
      automatedCoveragePercent: toPercent(met + failed, totalCriteria),
    },
    criteria,
    violations: {
      findings,
      rules,
      byImpact,
      totalOccurrences: rules.reduce((total, { occurrences }) => total + occurrences, 0),
      uniqueElements: rules.reduce((total, { uniqueElements }) => total + uniqueElements, 0),
    },
    otherViolations: summarizeRules(
      scans,
      AUDIT_OUTCOME.VIOLATION,
      (rule) => !isWcag21AaRule(rule),
    ),
    needsReview: summarizeRules(scans, AUDIT_OUTCOME.NEEDS_REVIEW, isWcag21AaRule),
  };
};

/** Baseline keys: one per rule per view, so a known failure on a new view still counts as new. */
export const findingKeys = (summary: WcagAuditSummary) =>
  [
    ...new Set(summary.violations.findings.map(({ viewId, ruleId }) => `${viewId}::${ruleId}`)),
  ].sort();

export const compareWithBaseline = (summary: WcagAuditSummary, baseline: string[]) => {
  const current = findingKeys(summary);
  const known = new Set(baseline);
  const currentSet = new Set(current);

  return {
    newFindings: current.filter((key) => !known.has(key)),
    resolvedFindings: baseline.filter((key) => !currentSet.has(key)),
  };
};

const STATUS_LABEL: Record<CriterionStatus, string> = {
  failed: "❌ Failed",
  met: "✅ Met",
  "no-automated-failures": "🟡 No automated failures (manual check needed)",
  "needs-review": "🟠 Needs review",
  "not-verified": "⚪ Not verifiable automatically",
};

const escapeCell = (value: string) =>
  value
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const formatRuleLink = ({ ruleId, helpUrl }: { ruleId: string; helpUrl?: string }) =>
  helpUrl ? `[\`${ruleId}\`](${helpUrl.split("?")[0]})` : `\`${ruleId}\``;

const MAX_NODES_PER_FINDING = 5;

/** Renders the audit as a Markdown report. */
export const renderWcagAuditMarkdown = (summary: WcagAuditSummary) => {
  const { score, violations } = summary;
  const lines: string[] = [];
  const impactRow = (label: string, counts: ImpactCounts) =>
    `| ${label} | ${IMPACT_ORDER.map((impact) => counts[impact]).join(" | ")} | ${IMPACT_ORDER.reduce((total, impact) => total + counts[impact], 0)} |`;

  lines.push(
    "# WCAG 2.1 AA automated audit",
    "",
    `Generated ${summary.generatedAt} with axe-core ${summary.axeVersion} and Mentingo checks; ${summary.views.length} views and states scanned.`,
    "",
    "> Automated tools find only part of the accessibility problems. A criterion without automated failures is not proven to pass; only a manual audit (keyboard, screen readers, zoom, content review) can confirm conformance.",
    "",
    "## Result",
    "",
    `- **Verdict:** ${summary.verdict === "conformant" ? "no failed criteria found by automation (manual audit still required)" : `**not conformant** with WCAG 2.1 AA: ${score.failed} of ${score.totalCriteria} success criteria fail`}`,
    `- **Estimated conformance (criteria automation could assess):** ${score.automatedEstimatePercent}% (${score.met} met or without automated failures / ${score.met + score.failed} assessed)`,
    `- **Range over all ${score.totalCriteria} criteria:** ${score.lowerBoundPercent}% (every unverified criterion fails) – ${score.upperBoundPercent}% (every unverified criterion passes)`,
    `- **Automated coverage:** ${score.automatedCoveragePercent}% of criteria got a pass/fail signal; ${score.notVerifiable} need manual testing or review`,
    "",
    "| Status | Criteria |",
    "|---|---|",
    ...Object.values(CRITERION_STATUS).map(
      (status) =>
        `| ${STATUS_LABEL[status]} | ${summary.criteria.filter((criterion) => criterion.status === status).length} |`,
    ),
    "",
    "## Violations (WCAG 2.1 A/AA)",
    "",
    `${violations.rules.length} rules violated, ${violations.findings.length} findings (rule × view), ${violations.totalOccurrences} occurrences (elements across all scans), about ${violations.uniqueElements} distinct elements (shared layout counted once).`,
    "",
    "| Count | Critical | Serious | Moderate | Minor | Total |",
    "|---|---|---|---|---|---|",
    impactRow("Rules", violations.byImpact.rules),
    impactRow("Findings (rule × view)", violations.byImpact.findings),
    impactRow("Occurrences", violations.byImpact.occurrences),
    "",
    "| Rule | Impact | WCAG | Views | Occurrences | Distinct elements | Problem |",
    "|---|---|---|---|---|---|---|",
    ...violations.rules.map(
      (rule) =>
        `| ${formatRuleLink(rule)} | ${rule.impact} | ${rule.criteria.filter((criterion) => WCAG21_AA_CRITERION_IDS.has(criterion)).join(", ")} | ${rule.views.length} | ${rule.occurrences} | ${rule.uniqueElements} | ${escapeCell(rule.help)} |`,
    ),
    "",
    "## Success criteria",
    "",
    "| SC | Level | Name | Status | Evidence |",
    "|---|---|---|---|---|",
    ...summary.criteria.map((criterion) => {
      const evidence = match(criterion.status)
        .with(CRITERION_STATUS.FAILED, () => `fails: ${criterion.violatedRules.join(", ")}`)
        .with(CRITERION_STATUS.NEEDS_REVIEW, () => `review: ${criterion.reviewRules.join(", ")}`)
        .with(CRITERION_STATUS.NOT_VERIFIED, () =>
          criterion.automation === AUTOMATION_LEVEL.MANUAL
            ? "manual test only"
            : "no applicable content in scanned views",
        )
        .with(CRITERION_STATUS.MET, CRITERION_STATUS.NO_AUTOMATED_FAILURES, () =>
          criterion.alwaysSatisfied
            ? "always satisfied for HTML (WCAG 2.1 errata)"
            : `passes: ${criterion.passedRules.join(", ")}`,
        )
        .exhaustive();
      return `| ${criterion.id} | ${criterion.level} | ${criterion.title} | ${STATUS_LABEL[criterion.status]} | ${escapeCell(evidence)} |`;
    }),
    "",
    "## Locations",
    "",
  );

  summary.views.forEach((view) => {
    const viewFindings = violations.findings.filter(({ viewId }) => viewId === view.viewId);
    lines.push(`### ${view.viewName} (\`${view.viewId}\`, ${view.role}, \`${view.path}\`)`, "");
    if (!viewFindings.length) lines.push("No WCAG 2.1 A/AA violations found by automation.");
    viewFindings.forEach((finding) => {
      lines.push(
        `- ${formatRuleLink(finding)} (${finding.impact}, ${finding.criteria.join(", ")}): ${escapeCell(finding.help)}`,
      );
      finding.nodes.slice(0, MAX_NODES_PER_FINDING).forEach(({ target, summary: nodeSummary }) => {
        lines.push(
          `  - \`${target}\`${nodeSummary ? ` — ${escapeCell(nodeSummary.split("\n").at(-1) ?? "")}` : ""}`,
        );
      });
      if (finding.nodes.length > MAX_NODES_PER_FINDING) {
        lines.push(`  - …and ${finding.nodes.length - MAX_NODES_PER_FINDING} more`);
      }
    });
    lines.push("");
  });

  lines.push(
    "## Needs manual review",
    "",
    "Results axe or the heuristics could not decide. They are not counted as failures.",
    "",
    "| Rule | WCAG | Views | Occurrences | Check |",
    "|---|---|---|---|---|",
    ...summary.needsReview.map(
      (rule) =>
        `| ${formatRuleLink(rule)} | ${rule.criteria.join(", ")} | ${rule.views.length} | ${rule.occurrences} | ${escapeCell(rule.help)} |`,
    ),
    "",
    "## Outside WCAG 2.1 AA (informational)",
    "",
    "WCAG 2.2 AA rules and axe best practices; not part of the score.",
    "",
    "| Rule | Impact | Tags | Views | Occurrences | Problem |",
    "|---|---|---|---|---|---|",
    ...summary.otherViolations.map(
      (rule) =>
        `| ${formatRuleLink(rule)} | ${rule.impact} | ${rule.criteria.join(", ") || "best-practice"} | ${rule.views.length} | ${rule.occurrences} | ${escapeCell(rule.help)} |`,
    ),
    "",
    "## Scanned views",
    "",
    "| View | Role | Path | Title |",
    "|---|---|---|---|",
    ...summary.views.map(
      ({ viewId, viewName, role, path, title }) =>
        `| ${viewName} (\`${viewId}\`) | ${role} | \`${path}\` | ${escapeCell(title)} |`,
    ),
    "",
  );

  return lines.join("\n");
};
