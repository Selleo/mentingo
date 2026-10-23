export type AssistantOutcome = {
  kind: "answer" | "conversation";
  text: string;
  requiresReadableContent: boolean;
};

export type AssistantOutcomeEvidence = {
  successfulToolCalls: number;
  readableToolCalls: number;
};

export type AssistantOutcomeValidation =
  | { accepted: true; outcome: AssistantOutcome }
  | {
      accepted: false;
      code: "EMPTY_RESPONSE" | "NO_VERIFIED_EVIDENCE" | "NO_READABLE_EVIDENCE";
      feedback: string;
    };
