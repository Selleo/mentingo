import { AI_MENTOR_CONFIGURATION_GENERATION_STATUS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { getAiMentorGenerationRefetchInterval } from "./useAiMentorConfigurationGenerationSnapshot";

describe("getAiMentorGenerationRefetchInterval", () => {
  it.each([
    AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
    AI_MENTOR_CONFIGURATION_GENERATION_STATUS.EVALUATING,
    AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REVISING,
  ])("polls while %s is active", (status) => {
    expect(getAiMentorGenerationRefetchInterval(status)).toBe(2000);
  });

  it.each([
    AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION,
    AI_MENTOR_CONFIGURATION_GENERATION_STATUS.COMPLETED,
    AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REQUIRES_REVIEW,
    AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED,
    AI_MENTOR_CONFIGURATION_GENERATION_STATUS.CANCELLED,
  ])("stops polling when %s is terminal", (status) => {
    expect(getAiMentorGenerationRefetchInterval(status)).toBe(false);
  });
});
