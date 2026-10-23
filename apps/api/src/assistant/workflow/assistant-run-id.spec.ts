import { assistantWorkflowRunId } from "./assistant-run-id";

const decodeTimestamp = (runId: string) => {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  return [...runId.slice(5, 15)].reduce((value, digit) => value * 32 + alphabet.indexOf(digit), 0);
};

describe("assistantWorkflowRunId", () => {
  const input = {
    tenantId: "tenant-id",
    runId: "logical-run-id",
    createdAt: "2026-10-23T08:29:59.443Z",
  };

  it("keeps the persisted creation time in the Workflow VM clock's ULID timestamp", () => {
    const runId = assistantWorkflowRunId(input);
    expect(runId).toMatch(/^wrun_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    expect(decodeTimestamp(runId)).toBe(Date.parse(input.createdAt));
    expect(assistantWorkflowRunId({ ...input, createdAt: "2026-10-23 08:29:59.443+00" })).toBe(
      runId,
    );
  });

  it("preserves identity when an enqueue handoff is retried later", () => {
    const original = assistantWorkflowRunId(input);
    const clock = jest.spyOn(Date, "now").mockReturnValue(Date.parse("2027-01-01T00:00:00Z"));
    try {
      expect(assistantWorkflowRunId({ ...input })).toBe(original);
      expect(assistantWorkflowRunId({ ...input, tenantId: "other-tenant" })).not.toBe(original);
    } finally {
      clock.mockRestore();
    }
  });

  it.each(["invalid", "1969-12-31T23:59:59.999Z"])(
    "rejects invalid timestamp %s instead of inventing a clock",
    (createdAt) => {
      expect(() => assistantWorkflowRunId({ ...input, createdAt })).toThrow("creation time");
    },
  );
});
