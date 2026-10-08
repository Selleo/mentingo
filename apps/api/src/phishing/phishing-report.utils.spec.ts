import { filterPhishingRecipients, phishingTotals } from "./phishing-report.utils";

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
describe("phishing report scoping", () => {
  it("removes other departments and recalculates totals from visible recipients", () => {
    const visible = filterPhishingRecipients(
      [recipient, { ...recipient, userId: "other", groupIds: ["three"] }],
      ["one"],
    );
    expect(visible).toEqual([{ ...recipient, groupIds: ["one"] }]);
    expect(phishingTotals(visible)).toMatchObject({ recipients: 1, risky: 1, riskRate: 100 });
  });
  it("fails closed for managers without groups", () =>
    expect(filterPhishingRecipients([recipient], [])).toEqual([]));
  it("preserves administrator visibility and counts each risky recipient once", () => {
    expect(filterPhishingRecipients([recipient], null)).toEqual([recipient]);
    expect(phishingTotals([{ ...recipient, submittedAt: "now" }]).risky).toBe(1);
    expect(phishingTotals([]).riskRate).toBe(0);
  });
});
