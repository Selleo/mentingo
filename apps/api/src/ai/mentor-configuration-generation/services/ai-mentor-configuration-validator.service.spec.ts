import {
  AI_MENTOR_CONFIGURATION_FIELD,
  AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { loadAiSdk } from "src/ai/utils/ai-esm";

import { AiMentorConfigurationValidatorService } from "./ai-mentor-configuration-validator.service";

import type { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import type { PromptService } from "src/ai/services/prompt.service";

jest.mock("@langfuse/tracing", () => ({
  observe: (callback: () => unknown) => callback,
  updateActiveObservation: jest.fn(),
}));
jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn() }));

const configuration = {
  type: AI_MENTOR_TYPE.TEACHER,
  taskGoal: "Teach discovery.",
  expertise: "Sales coaching",
  contentScope: "Discovery questions.",
  teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
};

describe("AiMentorConfigurationValidatorService", () => {
  const createService = (output: object) => {
    jest.mocked(loadAiSdk).mockResolvedValue({
      generateText: jest.fn().mockResolvedValue({ output }),
      jsonSchema: jest.fn((schema) => schema),
      Output: { object: jest.fn((options) => options) },
    } as never);
    const promptService = {
      loadPrompt: jest.fn().mockResolvedValue("VALIDATOR"),
      isNotEmpty: jest.fn().mockResolvedValue(undefined),
      getOpenAI: jest.fn().mockResolvedValue(jest.fn().mockReturnValue("MODEL")),
    };
    const aiRuntimeService = {
      validateMentorConfiguration: jest.fn(
        (_input: unknown, validateCoreConfiguration: () => Promise<unknown>) =>
          validateCoreConfiguration(),
      ),
    };

    return {
      aiRuntimeService,
      service: new AiMentorConfigurationValidatorService(
        promptService as unknown as PromptService,
        aiRuntimeService as unknown as AiRuntimeService,
      ),
    };
  };

  it("derives a pass from warnings and validates the current type-specific target", async () => {
    const { aiRuntimeService, service } = createService({
      summary: "The configuration is usable.",
      issues: [
        {
          code: "scope_could_be_tighter",
          severity: AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY.WARNING,
          target: { field: AI_MENTOR_CONFIGURATION_FIELD.CONTENT_SCOPE },
          message: "The scope is broad.",
          correction: "Name the most important boundary.",
        },
      ],
    });

    await expect(
      service.validate({
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext: { title: "Discovery" },
        configuration,
      }),
    ).resolves.toMatchObject({ passed: true });
    expect(aiRuntimeService.validateMentorConfiguration).toHaveBeenCalledWith(
      {
        messages: [
          { role: "system", content: "VALIDATOR" },
          { role: "user", content: expect.stringContaining("<input_json>") },
        ],
        temperature: 0,
      },
      expect.any(Function),
    );
  });

  it("rejects a target belonging to the other configuration type", async () => {
    const { service } = createService({
      summary: "The configuration needs review.",
      issues: [
        {
          code: "role_unclear",
          severity: AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY.ERROR,
          target: { field: AI_MENTOR_CONFIGURATION_FIELD.AI_ROLE },
          message: "The role is unclear.",
          correction: "Clarify the role.",
        },
      ],
    });

    await expect(
      service.validate({
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext: { title: "Discovery" },
        configuration,
      }),
    ).rejects.toThrow("outside teacher configuration");
  });

  it("rejects type as a model validation target", async () => {
    const { service } = createService({
      summary: "The type should change.",
      issues: [
        {
          code: "change_type",
          severity: AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY.ERROR,
          target: { field: "type" },
          message: "Change the type.",
          correction: "Use Roleplay.",
        },
      ],
    });

    await expect(
      service.validate({
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext: { title: "Discovery" },
        configuration,
      }),
    ).rejects.toThrow("invalid result structure");
  });
});
