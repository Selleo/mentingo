import { isAcceptedAssistantOutcome, validateAssistantOutcome } from "./workflow/assistant-outcome";

const noEvidence = { successfulToolCalls: 0, readableToolCalls: 0 };

describe("Assistant outcome policy", () => {
  it("accepts conversation without manufacturing a read requirement", () => {
    const outcome = { kind: "conversation" as const, text: "Hej!", requiresReadableContent: false };
    expect(validateAssistantOutcome(outcome, noEvidence)).toEqual({ accepted: true, outcome });
  });

  it("rejects unsupported factual answers with actionable repair feedback", () => {
    const result = validateAssistantOutcome(
      { kind: "answer", text: "An unsupported fact", requiresReadableContent: false },
      noEvidence,
    );
    expect(result).toEqual(
      expect.objectContaining({ accepted: false, code: "NO_VERIFIED_EVIDENCE" }),
    );
    expect(isAcceptedAssistantOutcome(result)).toBe(false);
  });

  it("requires readable content for summaries even after metadata reads", () => {
    expect(
      validateAssistantOutcome(
        { kind: "answer", text: "A summary", requiresReadableContent: true },
        { successfulToolCalls: 1, readableToolCalls: 0 },
      ),
    ).toEqual(expect.objectContaining({ accepted: false, code: "NO_READABLE_EVIDENCE" }));
  });

  it("accepts grounded content replies and rejects empty replies", () => {
    const outcome = {
      kind: "answer" as const,
      text: "A grounded summary",
      requiresReadableContent: true,
    };
    expect(
      isAcceptedAssistantOutcome(
        validateAssistantOutcome(outcome, { successfulToolCalls: 1, readableToolCalls: 1 }),
      ),
    ).toBe(true);
    expect(validateAssistantOutcome({ ...outcome, text: " " }, noEvidence)).toEqual(
      expect.objectContaining({ accepted: false, code: "EMPTY_RESPONSE" }),
    );
  });
});
