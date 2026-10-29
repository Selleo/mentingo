import { describe, expect, it } from "vitest";

import { countOutcomes, percentOf, toApiSort } from "./phishingReport.utils";

describe("toApiSort", () => {
  it("prefixes descending fields with a minus", () => {
    expect(toApiSort({ field: "name", direction: "asc" })).toBe("name");
    expect(toApiSort({ field: "clickedAt", direction: "desc" })).toBe("-clickedAt");
  });
});

describe("countOutcomes", () => {
  it("puts each person in exactly one outcome", () => {
    expect(
      countOutcomes({ recipients: 5, sent: 5, clicked: 2, submitted: 1, risky: 3, riskRate: 60 }),
    ).toEqual({ submitted: 1, clickedOnly: 2, noAction: 2 });
  });
});

describe("percentOf", () => {
  it("rounds and guards against an empty total", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(1, 0)).toBe(0);
  });
});
