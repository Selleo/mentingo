import type {
  GetPhishingReportRecipientsResponse,
  GetPhishingReportResponse,
} from "~/api/generated-api";

export type PhishingReportSummary = GetPhishingReportResponse["data"];
export type PhishingRecipient = GetPhishingReportRecipientsResponse["data"][number];
export type PhishingActivity = PhishingReportSummary["activity"][number];
export type PhishingTotals = PhishingReportSummary["totals"];

export const RECIPIENT_COLUMNS = [
  { key: "person", sortField: "name" },
  { key: "sent", sortField: "sentAt" },
  { key: "clicked", sortField: "clickedAt" },
  { key: "submitted", sortField: "submittedAt" },
  { key: "courseStatus" },
] as const;

export type RecipientSortField = Extract<
  (typeof RECIPIENT_COLUMNS)[number],
  { sortField: string }
>["sortField"];
export type RecipientSort = { field: RecipientSortField; direction: "asc" | "desc" };

export const RECIPIENT_FILTERS = { ALL: "all", AT_RISK: "atRisk" } as const;
export type RecipientFilter = (typeof RECIPIENT_FILTERS)[keyof typeof RECIPIENT_FILTERS];

/** The API expects `field` for ascending and `-field` for descending order. */
export const toApiSort = ({ field, direction }: RecipientSort) =>
  direction === "asc" ? field : (`-${field}` as const);

export const percentOf = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 0;

export const ACTIVITY_TYPES = { CLICKED: "clicked", SUBMITTED: "submitted" } as const;
/** What a scenario counts as risky; click-only scenarios never record submissions. */
export const PHISHING_RISKY_ACTIONS = ACTIVITY_TYPES;

export const OUTCOMES = {
  SUBMITTED: "submitted",
  CLICKED_ONLY: "clickedOnly",
  NO_ACTION: "noAction",
} as const;
export type Outcome = (typeof OUTCOMES)[keyof typeof OUTCOMES];

/** Splits recipients into exclusive outcomes; `risky` already counts each person once. */
export function countOutcomes(totals: PhishingTotals): Record<Outcome, number> {
  return {
    [OUTCOMES.SUBMITTED]: totals.submitted,
    [OUTCOMES.CLICKED_ONLY]: totals.risky - totals.submitted,
    [OUTCOMES.NO_ACTION]: totals.recipients - totals.risky,
  };
}
