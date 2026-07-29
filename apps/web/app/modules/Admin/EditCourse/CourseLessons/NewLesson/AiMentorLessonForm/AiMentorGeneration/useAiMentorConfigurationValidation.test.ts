import { AI_MENTOR_TEACHING_STYLE, AI_MENTOR_TYPE } from "@repo/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAiMentorConfigurationValidation } from "./useAiMentorConfigurationValidation";

import type { AiMentorValidationResult } from "./aiMentorGeneration.types";
import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";

const unsavedConfiguration: AiMentorConfigurationDraft = {
  type: AI_MENTOR_TYPE.TEACHER,
  taskGoal: "Unsaved goal",
  expertise: "Unsaved expertise",
  contentScope: "Unsaved scope",
  teachingStyle: AI_MENTOR_TEACHING_STYLE.SOCRATIC,
};

const successfulValidation: AiMentorValidationResult = {
  passed: true,
  summary: "The configuration is ready.",
  issues: [],
};

describe("useAiMentorConfigurationValidation", () => {
  it("passes the exact unsaved configuration and stores only the validation result", async () => {
    const before = structuredClone(unsavedConfiguration);
    const validate = vi.fn().mockResolvedValue(successfulValidation);
    const { result } = renderHook(() => useAiMentorConfigurationValidation(validate));

    await act(async () => {
      await result.current.validateConfiguration(unsavedConfiguration);
    });

    expect(validate).toHaveBeenCalledWith(unsavedConfiguration, expect.any(AbortSignal));
    expect(result.current.result).toEqual(successfulValidation);
    expect(unsavedConfiguration).toEqual(before);
  });

  it("aborts an in-flight quality check and clears its UX state", () => {
    let receivedSignal: AbortSignal | undefined;
    const validate = vi.fn((_configuration: AiMentorConfigurationDraft, signal: AbortSignal) => {
      receivedSignal = signal;
      return new Promise<AiMentorValidationResult>(() => {});
    });
    const { result, unmount } = renderHook(() => useAiMentorConfigurationValidation(validate));

    act(() => {
      void result.current.validateConfiguration(unsavedConfiguration);
    });
    expect(result.current.isChecking).toBe(true);
    expect(receivedSignal?.aborted).toBe(false);

    act(() => {
      result.current.cancel();
    });

    expect(receivedSignal?.aborted).toBe(true);
    expect(result.current.isChecking).toBe(false);
    expect(result.current.result).toBeUndefined();
    unmount();
  });
});
