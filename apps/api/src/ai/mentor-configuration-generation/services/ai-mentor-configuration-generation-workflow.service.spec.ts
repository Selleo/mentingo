import {
  AI_MENTOR_CONFIGURATION_FIELD,
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
  AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { AiMentorConfigurationGenerationWorkflowService } from "./ai-mentor-configuration-generation-workflow.service";

import type { AiMentorConfigurationGeneratorService } from "./ai-mentor-configuration-generator.service";
import type { AiMentorConfigurationValidatorService } from "./ai-mentor-configuration-validator.service";

jest.mock("@langfuse/tracing", () => ({
  observe: (callback: () => unknown) => callback,
  updateActiveObservation: jest.fn(),
}));

const teacherDraft = {
  type: AI_MENTOR_TYPE.TEACHER,
  taskGoal: "Teach discovery.",
  expertise: "Sales coaching",
  contentScope: "Discovery questions.",
  teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
};

const passedValidation = {
  passed: true,
  summary: "The configuration is ready.",
  issues: [],
};

const failedValidation = {
  passed: false,
  summary: "The scope needs correction.",
  issues: [
    {
      code: "scope_too_broad",
      severity: AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY.ERROR,
      target: { field: AI_MENTOR_CONFIGURATION_FIELD.CONTENT_SCOPE },
      message: "The scope is too broad.",
      correction: "Define one clear boundary.",
    },
  ],
};

const createInput = {
  mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
  configurationType: AI_MENTOR_TYPE.TEACHER,
  language: SUPPORTED_LANGUAGES.EN,
  lessonContext: { title: "Discovery" },
  brief: "Create a guided Teacher.",
};

describe("AiMentorConfigurationGenerationWorkflowService", () => {
  const createService = () => {
    const generatorService = { generate: jest.fn() };
    const validatorService = { validate: jest.fn() };
    const service = new AiMentorConfigurationGenerationWorkflowService(
      generatorService as unknown as AiMentorConfigurationGeneratorService,
      validatorService as unknown as AiMentorConfigurationValidatorService,
    );
    const statuses: string[] = [];

    return {
      generatorService,
      validatorService,
      service,
      options: {
        reportProgress: (progress: { status: string }) => {
          statuses.push(progress.status);
        },
      },
      statuses,
    };
  };

  it("completes a first draft with the immutable creator-selected type", async () => {
    const { generatorService, validatorService, service, options, statuses } = createService();
    generatorService.generate.mockResolvedValue(teacherDraft);
    validatorService.validate.mockResolvedValue(passedValidation);

    const result = await service.run(createInput, options);

    expect(result).toMatchObject({
      status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.COMPLETED,
      configuration: { type: AI_MENTOR_TYPE.TEACHER },
      validation: passedValidation,
    });
    expect(statuses).toEqual(["drafting", "evaluating", "completed"]);
  });

  it("fails safely when a generator attempts to change the type", async () => {
    const { generatorService, validatorService, service } = createService();
    generatorService.generate.mockResolvedValue({
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "A sales meeting.",
      aiRole: "Buyer",
      learnerRole: "Seller",
      characterGoal: "Understand the offer.",
      difficulty: "realistic",
    });

    const result = await service.run(createInput);

    expect(result).toMatchObject({
      status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED,
    });
    expect(validatorService.validate).not.toHaveBeenCalled();
  });

  it("uses deterministic findings before semantic validation", async () => {
    const { generatorService, validatorService, service } = createService();
    generatorService.generate.mockResolvedValue({ ...teacherDraft, taskGoal: " " });

    const result = await service.run(createInput);

    expect(result).toMatchObject({
      status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION,
      validation: {
        passed: false,
        issues: [
          expect.objectContaining({
            target: { field: AI_MENTOR_CONFIGURATION_FIELD.TASK_GOAL },
          }),
        ],
      },
    });
    expect(validatorService.validate).not.toHaveBeenCalled();
  });

  it("preserves the type and attempt history through an approved repair", async () => {
    const { generatorService, validatorService, service } = createService();
    generatorService.generate.mockResolvedValue({
      ...teacherDraft,
      contentScope: "Discovery questions only.",
    });
    validatorService.validate.mockResolvedValue(passedValidation);

    const result = await service.run(
      {
        mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.REPAIR,
        configurationType: AI_MENTOR_TYPE.TEACHER,
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext: { title: "Discovery" },
        currentConfiguration: teacherDraft,
        blockingIssues: failedValidation.issues,
      },
      {
        attempt: 2,
        attemptHistory: [{ attempt: 1, changes: [], validation: failedValidation }],
      },
    );

    expect(result).toMatchObject({
      status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.COMPLETED,
      attempt: 2,
      configuration: { type: AI_MENTOR_TYPE.TEACHER },
      attemptHistory: [
        { attempt: 1, validation: failedValidation },
        { attempt: 2, validation: passedValidation },
      ],
    });
  });
});
