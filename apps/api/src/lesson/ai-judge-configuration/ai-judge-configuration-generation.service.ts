import { Injectable } from "@nestjs/common";

import {
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_GENERATION_STATUS,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import { AiJudgeConfigurationGenerationWorkflowService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generation-workflow.service";
import { AiJudgeConfigurationValidatorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-validator.service";
import { getDeterministicAiJudgeConfigurationValidation } from "src/ai/judge-configuration-generation/utils/ai-judge-configuration-draft";
import {
  reconcileAiJudgeConfigurationDraft,
  referenceAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/utils/ai-judge-configuration-references";

import { AiJudgeConfigurationService } from "./ai-judge-configuration.service";

import type {
  AiJudgeGenerationExecutionOptions,
  GenerateAiJudgeConfigurationApplicationResult,
  PreparedAiJudgeConfigurationGeneration,
} from "./ai-judge-configuration-generation.types";
import type { SupportedLanguages } from "@repo/shared";
import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeGenerationAttempt,
  AiJudgeGenerationApplicationProgressEvent,
  AiJudgeGenerationProgressEvent,
  GenerateAiJudgeConfigurationInput,
  ReferencedAiJudgeConfiguration,
  ValidateAiJudgeConfigurationInput,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationIdentityMap } from "src/ai/judge-configuration-generation/utils/ai-judge-configuration-references.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AiJudgeConfigurationGenerationService {
  constructor(
    private readonly aiJudgeConfigurationService: AiJudgeConfigurationService,
    private readonly aiJudgeConfigurationGenerationWorkflowService: AiJudgeConfigurationGenerationWorkflowService,
    private readonly aiJudgeConfigurationValidatorService: AiJudgeConfigurationValidatorService,
  ) {}

  async generate(
    input: GenerateAiJudgeConfigurationInput,
    currentUser: CurrentUserType,
    options: AiJudgeGenerationExecutionOptions = {},
  ): Promise<GenerateAiJudgeConfigurationApplicationResult> {
    const prepared = await this.prepare(input, currentUser);

    return this.execute(prepared, options);
  }

  async prepare(
    input: GenerateAiJudgeConfigurationInput,
    currentUser: CurrentUserType,
  ): Promise<PreparedAiJudgeConfigurationGeneration> {
    const context = await this.aiJudgeConfigurationService.prepareGenerationAuthoringContext(
      input.courseId,
      input.lessonId,
      currentUser,
    );

    return this.prepareGeneration(input, context.baseLanguage);
  }

  async execute(
    prepared: PreparedAiJudgeConfigurationGeneration,
    options: AiJudgeGenerationExecutionOptions = {},
  ): Promise<GenerateAiJudgeConfigurationApplicationResult> {
    let latestDraft: ReferencedAiJudgeConfiguration | undefined;
    const result = await this.aiJudgeConfigurationGenerationWorkflowService.run(
      prepared.workflowInput,
      {
        attempt: prepared.attempt,
        attemptHistory: prepared.attemptHistory,
        isCancelled: options.isCancelled,
        onDraft: async (draft) => {
          latestDraft = draft;
          await options.onReferencedDraft?.(draft);
        },
        reportProgress: async (progress) => {
          await options.reportProgress?.(
            this.reconcileProgress(progress, latestDraft, prepared.identities),
          );
        },
      },
    );

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

    return this.aiJudgeConfigurationValidatorService.validate({
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
        attempt: 1,
        attemptHistory: [],
      };
    }

    const referenced = referenceAiJudgeConfiguration(input.currentConfiguration);

    return {
      workflowInput: {
        mode: input.mode,
        language,
        lessonContext: input.lessonContext,
        instruction: input.instruction,
        creatorInstruction: input.instruction,
        currentConfiguration: referenced.configuration,
        brief: input.brief,
        latestValidation: input.latestValidation,
      },
      identities: referenced.identities,
      attempt: 1,
      attemptHistory: [],
    };
  }

  prepareRevision(
    previous: PreparedAiJudgeConfigurationGeneration,
    referencedConfiguration: ReferencedAiJudgeConfiguration,
    validation: AiJudgeConfigurationValidationResult,
    attemptHistory: AiJudgeGenerationAttempt[],
  ): PreparedAiJudgeConfigurationGeneration {
    return {
      workflowInput: {
        mode: AI_JUDGE_GENERATION_MODE.REPAIR,
        language: previous.workflowInput.language,
        lessonContext: previous.workflowInput.lessonContext,
        brief: previous.workflowInput.brief,
        creatorInstruction: previous.workflowInput.creatorInstruction,
        currentConfiguration: referencedConfiguration,
        blockingIssues: validation.issues,
      },
      identities: previous.identities,
      attempt: attemptHistory.length + 1,
      attemptHistory,
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

  private reconcileProgress(
    progress: AiJudgeGenerationProgressEvent,
    latestDraft: ReferencedAiJudgeConfiguration | undefined,
    identities: AiJudgeConfigurationIdentityMap,
  ): AiJudgeGenerationApplicationProgressEvent {
    switch (progress.status) {
      case AI_JUDGE_GENERATION_STATUS.DRAFTING:
        return progress;
      case AI_JUDGE_GENERATION_STATUS.EVALUATING:
      case AI_JUDGE_GENERATION_STATUS.REVISING:
        return {
          ...progress,
          draft: reconcileAiJudgeConfigurationDraft(progress.draft, identities),
        };
      case AI_JUDGE_GENERATION_STATUS.COMPLETED:
      case AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION:
      case AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW:
      case AI_JUDGE_GENERATION_STATUS.FAILED:
      case AI_JUDGE_GENERATION_STATUS.CANCELLED:
        return this.reconcileResult(progress, latestDraft, identities);
    }
  }
}
