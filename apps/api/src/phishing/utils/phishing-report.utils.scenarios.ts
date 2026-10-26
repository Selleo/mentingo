export const RECIPIENT = {
  userId: "user",
  email: "user@example.test",
  firstName: "Test",
  lastName: "User",
  groupIds: ["one", "two"],
  sentAt: "2026-01-01T00:00:00.000Z",
  clickedAt: "2026-01-01T00:05:00.000Z",
  submittedAt: null,
  failed: false,
};

export const GROUP_SCOPE_CASES = [
  {
    title: "keeps every membership for an unscoped viewer",
    groupScope: null,
    expectedGroupIds: ["one", "two"],
  },
  {
    title: "hides memberships outside the manager's groups",
    groupScope: ["one"],
    expectedGroupIds: ["one"],
  },
  {
    title: "hides every membership when no group is in scope",
    groupScope: ["other"],
    expectedGroupIds: [],
  },
] as const;

export const RISK_RATE_CASES = [
  { title: "rounds to two decimals", recipients: 3, risky: 1, expectedRiskRate: 33.33 },
  {
    title: "reports every recipient at risk as 100",
    recipients: 2,
    risky: 2,
    expectedRiskRate: 100,
  },
  { title: "reports an empty campaign as 0", recipients: 0, risky: 0, expectedRiskRate: 0 },
] as const;
