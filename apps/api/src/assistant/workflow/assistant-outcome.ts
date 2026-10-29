import { ASSISTANT_OUTCOME_KINDS, ASSISTANT_OUTCOME_VALIDATION_CODES } from "@repo/shared";

import type {
  AssistantOutcome,
  AssistantOutcomeEvidence,
  AssistantOutcomeValidation,
} from "./assistant-outcome.types";

/** One evidence policy for proposed final replies, streaming checkpoints and durable completion. */
export function validateAssistantOutcome(
  outcome: AssistantOutcome,
  evidence: AssistantOutcomeEvidence,
): AssistantOutcomeValidation {
  if (!outcome.text.trim()) {
    return {
      accepted: false,
      code: ASSISTANT_OUTCOME_VALIDATION_CODES.EMPTY_RESPONSE,
      feedback: "Provide a nonempty reply before calling respond again.",
    };
  }
  if (outcome.kind === ASSISTANT_OUTCOME_KINDS.ANSWER && !evidence.successfulToolCalls) {
    return {
      accepted: false,
      code: ASSISTANT_OUTCOME_VALIDATION_CODES.NO_VERIFIED_EVIDENCE,
      feedback:
        "No authoritative read has completed. For greetings, general help or a clarifying question without product claims, call respond again with kind=conversation. For factual product answers, use the available read tools first, then propose an answer supported by their results. Do not reclassify factual claims as conversation.",
    };
  }
  if (outcome.requiresReadableContent && !evidence.readableToolCalls) {
    return {
      accepted: false,
      code: ASSISTANT_OUTCOME_VALIDATION_CODES.NO_READABLE_EVIDENCE,
      feedback:
        "Only metadata is available. Fetch the readable lesson, article, news or Q&A body before summarizing or explaining its content. Otherwise clearly report what is unavailable without inventing a summary, then propose an appropriately scoped reply.",
    };
  }
  return { accepted: true, outcome };
}

export function isAssistantOutcome(value: unknown): value is AssistantOutcome {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const outcome = value as Record<string, unknown>;
  return (
    (outcome.kind === ASSISTANT_OUTCOME_KINDS.ANSWER ||
      outcome.kind === ASSISTANT_OUTCOME_KINDS.CONVERSATION) &&
    typeof outcome.text === "string" &&
    typeof outcome.requiresReadableContent === "boolean"
  );
}

export function isAcceptedAssistantOutcome(
  value: unknown,
): value is Extract<AssistantOutcomeValidation, { accepted: true }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return result.accepted === true && isAssistantOutcome(result.outcome);
}
