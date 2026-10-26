import type { AssistantOutcomeKind } from "@repo/shared";

export type AssistantOutcome = {
  kind: AssistantOutcomeKind;
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
