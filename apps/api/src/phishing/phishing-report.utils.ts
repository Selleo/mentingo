import type { RecipientResult } from "@mentingo/phishing";
export function filterPhishingRecipients<T extends RecipientResult>(
  recipients: T[],
  groupIds: string[] | null,
): T[] {
  if (groupIds === null) return recipients;
  const allowed = new Set(groupIds);
  return recipients
    .filter((r) => r.groupIds.some((id) => allowed.has(id)))
    .map((r) => ({ ...r, groupIds: r.groupIds.filter((id) => allowed.has(id)) }));
}
export function phishingTotals(recipients: RecipientResult[]) {
  const risky = recipients.filter((r) => r.clickedAt || r.submittedAt).length;
  return {
    recipients: recipients.length,
    sent: recipients.filter((r) => r.sentAt).length,
    clicked: recipients.filter((r) => r.clickedAt).length,
    submitted: recipients.filter((r) => r.submittedAt).length,
    risky,
    riskRate: recipients.length ? Math.round((risky / recipients.length) * 10000) / 100 : 0,
  };
}
