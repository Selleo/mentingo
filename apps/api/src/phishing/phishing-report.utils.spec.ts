import { scopeRecipientGroups, withRiskRate } from "./phishing-report.utils";

const recipient = {
  userId: "user",
  email: "user@example.test",
  firstName: "Test",
  lastName: "User",
  groupIds: ["one", "two"],
  sentAt: "now",
  clickedAt: "now",
  submittedAt: null,
  failed: false,
};
describe("phishing report helpers", () => {
  it("hides memberships outside the manager's groups", () => {
    expect(scopeRecipientGroups(recipient, ["one"])).toEqual({ ...recipient, groupIds: ["one"] });
  });
  it("preserves administrator visibility", () => {
    expect(scopeRecipientGroups(recipient, null)).toBe(recipient);
  });
  it("rounds the risk rate to two decimals and guards an empty campaign", () => {
    const totals = { recipients: 3, sent: 3, clicked: 1, submitted: 0, risky: 1 };
    expect(withRiskRate(totals).riskRate).toBe(33.33);
    expect(withRiskRate({ ...totals, recipients: 0, risky: 0 }).riskRate).toBe(0);
  });
});
