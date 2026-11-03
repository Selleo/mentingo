import { scopeRecipientGroups, withRiskRate } from "./phishing-report.utils";
import { GROUP_SCOPE_CASES, RECIPIENT, RISK_RATE_CASES } from "./phishing-report.utils.scenarios";

describe("phishing report helpers", () => {
  it.each(GROUP_SCOPE_CASES)("$title", ({ groupScope, expectedGroupIds }) => {
    expect(scopeRecipientGroups(RECIPIENT, groupScope ? [...groupScope] : null)).toEqual({
      ...RECIPIENT,
      groupIds: expectedGroupIds,
    });
  });

  it.each(RISK_RATE_CASES)("$title", ({ recipients, risky, expectedRiskRate }) => {
    const totals = { recipients, sent: recipients, clicked: risky, submitted: 0, risky };

    expect(withRiskRate(totals)).toEqual({ ...totals, riskRate: expectedRiskRate });
  });
});
