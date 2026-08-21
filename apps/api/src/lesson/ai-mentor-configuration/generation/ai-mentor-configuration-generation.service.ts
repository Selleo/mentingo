import { Injectable } from "@nestjs/common";
import { AI_MENTOR_CONFIGURATION_GENERATION_MODE } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { AiMentorConfigurationGenerationWorkflowService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-generation-workflow.service";
import { AiMentorConfigurationValidatorService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-validator.service";
import { getDeterministicAiMentorConfigurationValidation } from "src/ai/mentor-configuration-generation/utils/ai-mentor-configuration-draft";

import { aiMentorConfigurationContentSchema } from "../schemas/ai-mentor-configuration.schema";
import { AiMentorConfigurationService } from "../services/ai-mentor-configuration.service";

import type {
  AiMentorConfigurationGenerationExecutionOptions,
  GenerateAiMentorConfigurationApplicationResult,
  PreparedAiMentorConfigurationGeneration,
} from "./ai-mentor-configuration-generation.types";
import type {
  AiMentorConfigurationGenerationAttempt,
  AiMentorConfigurationValidationResult,
  GenerateAiMentorConfigurationInput,
  ValidateAiMentorConfigurationInput,
} from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

@Injectable()
export class AiMentorConfigurationGenerationService {
  constructor(
    private readonly configurationService: AiMentorConfigurationService,
    private readonly workflowService: AiMentorConfigurationGenerationWorkflowService,
    private readonly validatorService: AiMentorConfigurationValidatorService,
  ) {}

  async prepare(
    input: GenerateAiMentorConfigurationInput,
    currentUser: CurrentUserType,
  ): Promise<PreparedAiMentorConfigurationGeneration> {
    const context = await this.configurationService.prepareGenerationAuthoringContext(
      input.courseId,
      input.lessonId,
      currentUser,
    );

    if (input.mode === AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE)
      return {
        workflowInput: {
          mode: input.mode,
          configurationType: input.configurationType,
          language: context.baseLanguage,
          lessonContext: input.lessonContext,
          brief: input.brief,
        },
        attempt: 1,
        attemptHistory: [],
      };

    return {
      workflowInput: {
        mode: input.mode,
        configurationType: input.currentConfiguration.type,
        language: context.baseLanguage,
        lessonContext: input.lessonContext,
        instruction: input.instruction,
        creatorInstruction: input.instruction,
        currentConfiguration: input.currentConfiguration,
        brief: input.brief,
        latestValidation: input.latestValidation,
      },
      attempt: 1,
      attemptHistory: [],
    };
  }

  async execute(
    prepared: PreparedAiMentorConfigurationGeneration,
    options: AiMentorConfigurationGenerationExecutionOptions = {},
  ): Promise<GenerateAiMentorConfigurationApplicationResult> {
    return this.workflowService.run(prepared.workflowInput, {
      attempt: prepared.attempt,
      attemptHistory: prepared.attemptHistory,
      isCancelled: options.isCancelled,
      onDraft: options.onDraft,
      reportProgress: options.reportProgress,
    });
  }

  async validate(
    input: ValidateAiMentorConfigurationInput,
    currentUser: CurrentUserType,
  ): Promise<AiMentorConfigurationValidationResult> {
    const context = await this.configurationService.prepareGenerationAuthoringContext(
      input.courseId,
      input.lessonId,
      currentUser,
    );
    const deterministicValidation = getDeterministicAiMentorConfigurationValidation(
      input.configuration,
    );
    if (deterministicValidation) return deterministicValidation;

    if (!Value.Check(aiMentorConfigurationContentSchema, input.configuration))
      throw new Error("Deterministically valid AI Mentor configuration failed schema validation");

    return this.validatorService.validate({
      language: context.baseLanguage,
      lessonContext: input.lessonContext,
      configuration: input.configuration,
      brief: input.brief,
    });
  }

  prepareRevision(
    previous: PreparedAiMentorConfigurationGeneration,
    configuration: AiMentorConfigurationContent,
    validation: AiMentorConfigurationValidationResult,
    attemptHistory: AiMentorConfigurationGenerationAttempt[],
  ): PreparedAiMentorConfigurationGeneration {
    if (configuration.type !== previous.workflowInput.configurationType)
      throw new Error("AI Mentor configuration type cannot change during revision");

    return {
      workflowInput: {
        mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.REPAIR,
        configurationType: configuration.type,
        language: previous.workflowInput.language,
        lessonContext: previous.workflowInput.lessonContext,
        brief: previous.workflowInput.brief,
        creatorInstruction: previous.workflowInput.creatorInstruction,
        currentConfiguration: configuration,
        blockingIssues: validation.issues,
      },
      attempt: attemptHistory.length + 1,
      attemptHistory,
    };
  }
}
