import type { RecipientResult, ReportTotals } from "@mentingo/phishing-simulation-sdk";
export function withRiskRate(totals: ReportTotals) {
  return {
    ...totals,
    riskRate: totals.recipients ? Math.round((totals.risky / totals.recipients) * 10000) / 100 : 0,
  };
}
/** Hides memberships in groups outside a manager's scope; `null` means unscoped. */
export function scopeRecipientGroups<T extends RecipientResult>(
  recipient: T,
  groupIds: string[] | null,
): T {
  if (groupIds === null) return recipient;
  return { ...recipient, groupIds: recipient.groupIds.filter((id) => groupIds.includes(id)) };
}
