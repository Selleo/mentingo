export const AUDIT_OUTCOME = {
  VIOLATION: "violation",
  NEEDS_REVIEW: "needs-review",
  PASS: "pass",
  INAPPLICABLE: "inapplicable",
} as const;

export type AuditOutcome = (typeof AUDIT_OUTCOME)[keyof typeof AUDIT_OUTCOME];

export const AUDIT_IMPACT = {
  CRITICAL: "critical",
  SERIOUS: "serious",
  MODERATE: "moderate",
  MINOR: "minor",
} as const;

export type AuditImpact = (typeof AUDIT_IMPACT)[keyof typeof AUDIT_IMPACT];

export const AUDIT_ENGINE = {
  AXE: "axe-core",
  MENTINGO: "mentingo-check",
} as const;

export type AuditEngine = (typeof AUDIT_ENGINE)[keyof typeof AUDIT_ENGINE];

export type AuditNode = {
  target: string;
  html: string;
  summary?: string;
};

/** One rule evaluated on one scanned view: an axe rule or one of the custom checks. */
export type AuditRuleResult = {
  ruleId: string;
  engine: AuditEngine;
  outcome: AuditOutcome;
  criteria: string[];
  tags: string[];
  impact: AuditImpact | null;
  help: string;
  helpUrl?: string;
  nodes: AuditNode[];
};

export const AUDIT_ROLE = {
  ANONYMOUS: "anonymous",
  STUDENT: "student",
  ADMIN: "admin",
} as const;

export type AuditRole = (typeof AUDIT_ROLE)[keyof typeof AUDIT_ROLE];

/** Everything recorded for one view or state; attached to the Playwright result as JSON. */
export type ViewScan = {
  viewId: string;
  viewName: string;
  role: AuditRole;
  path: string;
  title: string;
  axeVersion: string;
  rules: AuditRuleResult[];
};

export const VIEW_SCAN_ATTACHMENT = "wcag-view-scan";
