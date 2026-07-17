import { Injectable } from "@nestjs/common";

import { getDeterministicAiJudgeConfigurationValidation } from "src/ai/judge-configuration-generation/ai-judge-configuration-draft";
import { AiJudgeConfigurationGenerationWorkflowService } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation-workflow.service";
import { AI_JUDGE_GENERATION_MODE } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import {
  reconcileAiJudgeConfigurationDraft,
  referenceAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-references";
import { AiJudgeConfigurationValidatorService } from "src/ai/judge-configuration-generation/ai-judge-configuration-validator.service";

import { AiJudgeConfigurationService } from "./ai-judge-configuration.service";

import type {
  AiJudgeGenerationExecutionOptions,
  GenerateAiJudgeConfigurationApplicationResult,
  PreparedAiJudgeConfigurationGeneration,
} from "./ai-judge-configuration-generation.types";
import type { SupportedLanguages } from "@repo/shared";
import type {
  AiJudgeConfigurationValidationResult,
  GenerateAiJudgeConfigurationInput,
  ReferencedAiJudgeConfiguration,
  ValidateAiJudgeConfigurationInput,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationIdentityMap } from "src/ai/judge-configuration-generation/ai-judge-configuration-references.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AiJudgeConfigurationGenerationService {
  constructor(
    private readonly aiJudgeConfigurationService: AiJudgeConfigurationService,
    private readonly workflowService: AiJudgeConfigurationGenerationWorkflowService,
    private readonly validatorService: AiJudgeConfigurationValidatorService,
  ) {}

  async generate(
    input: GenerateAiJudgeConfigurationInput,
    currentUser: CurrentUserType,
    options: AiJudgeGenerationExecutionOptions = {},
  ): Promise<GenerateAiJudgeConfigurationApplicationResult> {
    const context = await this.aiJudgeConfigurationService.prepareGenerationAuthoringContext(
      input.courseId,
      input.lessonId,
      currentUser,
    );
    const prepared = this.prepareGeneration(input, context.baseLanguage);
    let latestDraft: ReferencedAiJudgeConfiguration | undefined;
    const result = await this.workflowService.run(prepared.workflowInput, {
      ...options,
      onDraft: (draft) => {
        latestDraft = draft;
      },
    });

    return this.reconcileResult(result, latestDraft, prepared.identities);
  }

  async validate(
    input: ValidateAiJudgeConfigurationInput,
    currentUser: CurrentUserType,
  ): Promise<AiJudgeConfigurationValidationResult> {
    const context = await this.aiJudgeConfigurationService.prepareGenerationAuthoringContext(
      input.courseId,
      input.lessonId,
      currentUser,
    );
    const referenced = referenceAiJudgeConfiguration(input.configuration).configuration;
    const deterministicValidation = getDeterministicAiJudgeConfigurationValidation(
      undefined,
      referenced,
    );
    if (deterministicValidation) return deterministicValidation;

    return this.validatorService.validate({
      language: context.baseLanguage,
      lessonContext: input.lessonContext,
      configuration: referenced,
      brief: input.brief,
    });
  }

  private prepareGeneration(
    input: GenerateAiJudgeConfigurationInput,
    language: SupportedLanguages,
  ): PreparedAiJudgeConfigurationGeneration {
    if (input.mode === AI_JUDGE_GENERATION_MODE.CREATE) {
      return {
        workflowInput: {
          mode: input.mode,
          language,
          lessonContext: input.lessonContext,
          brief: input.brief,
        },
        identities: { criteria: [], blockingErrors: [] },
      };
    }

    const referenced = referenceAiJudgeConfiguration(input.currentConfiguration);

    return {
      workflowInput: {
        mode: input.mode,
        language,
        lessonContext: input.lessonContext,
        instruction: input.instruction,
        currentConfiguration: referenced.configuration,
        brief: input.brief,
        latestValidation: input.latestValidation,
      },
      identities: referenced.identities,
    };
  }

  private reconcileResult(
    result: Awaited<ReturnType<AiJudgeConfigurationGenerationWorkflowService["run"]>>,
    latestDraft: ReferencedAiJudgeConfiguration | undefined,
    identities: AiJudgeConfigurationIdentityMap,
  ): GenerateAiJudgeConfigurationApplicationResult {
    if (!result.configuration || !latestDraft) return result;

    return {
      ...result,
      configuration: reconcileAiJudgeConfigurationDraft(latestDraft, identities),
    };
  }
}
