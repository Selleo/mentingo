import { observe, updateActiveObservation } from "@langfuse/tracing";
import { Injectable } from "@nestjs/common";

import { diffAiJudgeConfigurationDrafts } from "./ai-judge-configuration-diff";
import {
  getDeterministicAiJudgeConfigurationValidation,
  stripAiJudgeConfigurationReferences,
} from "./ai-judge-configuration-draft";
import {
  AI_JUDGE_GENERATION_MAX_ATTEMPTS,
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_GENERATION_STATUS,
} from "./ai-judge-configuration-generation.types";
import { AiJudgeConfigurationGeneratorService } from "./ai-judge-configuration-generator.service";
import { AiJudgeConfigurationValidatorService } from "./ai-judge-configuration-validator.service";

import type {
  AiJudgeConfigurationGenerationWorkflowOptions,
  StartAiJudgeConfigurationGenerationInput,
} from "./ai-judge-configuration-generation-workflow.types";
import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeDraftChange,
  AiJudgeGenerationProgressEvent,
  AiJudgeGenerationResult,
  ReferencedAiJudgeConfiguration,
} from "./ai-judge-configuration-generation.schema";
import type { GenerateAiJudgeConfigurationDraftInput } from "./ai-judge-configuration-generator.types";

@Injectable()
export class AiJudgeConfigurationGenerationWorkflowService {
  constructor(
    private readonly aiJudgeConfigurationGeneratorService: AiJudgeConfigurationGeneratorService,
    private readonly aiJudgeConfigurationValidatorService: AiJudgeConfigurationValidatorService,
  ) {}

  async run(
    input: StartAiJudgeConfigurationGenerationInput,
    options: AiJudgeConfigurationGenerationWorkflowOptions = {},
  ): Promise<AiJudgeGenerationResult> {
    return observe(
      async () => {
        const result = await this.runAttempts(input, options);
        updateActiveObservation({ input: { mode: input.mode }, output: result });

        return result;
      },
      { name: "AI Judge Configuration Generation Workflow", asType: "chain" },
    )();
  }

  private async runAttempts(
    input: StartAiJudgeConfigurationGenerationInput,
    options: AiJudgeConfigurationGenerationWorkflowOptions,
  ): Promise<AiJudgeGenerationResult> {
    let generatorInput: GenerateAiJudgeConfigurationDraftInput = input;
    let latestDraft: ReferencedAiJudgeConfiguration | undefined;
    let latestChanges: AiJudgeDraftChange[] | undefined;

    for (let attempt = 1; attempt <= AI_JUDGE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const cancelledBeforeAttempt = await this.getCancelledResult(attempt, latestDraft, options);
      if (cancelledBeforeAttempt) return this.report(cancelledBeforeAttempt, options);

      await this.report({ status: AI_JUDGE_GENERATION_STATUS.DRAFTING, attempt }, options);

      const previousDraft = latestDraft ?? this.getInitialDraft(input);
      try {
        latestDraft = await this.aiJudgeConfigurationGeneratorService.generate(generatorInput);
        await options.onDraft?.(latestDraft);
        latestChanges = previousDraft
          ? diffAiJudgeConfigurationDrafts(previousDraft, latestDraft)
          : undefined;
      } catch (error) {
        return this.report(this.createFailedResult(attempt, latestDraft, error), options);
      }

      const cancelledAfterDraft = await this.getCancelledResult(attempt, latestDraft, options);
      if (cancelledAfterDraft) return this.report(cancelledAfterDraft, options);

      const deterministicValidation = getDeterministicAiJudgeConfigurationValidation(
        previousDraft,
        latestDraft,
      );
      let validation: AiJudgeConfigurationValidationResult;

      if (deterministicValidation) validation = deterministicValidation;
      else {
        await this.report(this.createEvaluatingEvent(attempt, latestDraft, latestChanges), options);
        validation = await this.aiJudgeConfigurationValidatorService.validate({
          language: input.language,
          lessonContext: input.lessonContext,
          configuration: latestDraft,
          brief: input.brief,
        });

        const cancelledAfterValidation = await this.getCancelledResult(
          attempt,
          latestDraft,
          options,
        );
        if (cancelledAfterValidation) return this.report(cancelledAfterValidation, options);
      }

      if (validation.passed) {
        return this.report(
          this.createCompletedResult(attempt, latestDraft, validation, latestChanges),
          options,
        );
      }

      const terminalResult = this.getRequiresReviewResult(
        attempt,
        latestDraft,
        validation,
        latestChanges,
      );
      if (terminalResult) return this.report(terminalResult, options);

      await this.report(
        this.createRevisingEvent(attempt, latestDraft, validation, latestChanges),
        options,
      );
      generatorInput = this.createRepairInput(input, latestDraft, validation);
    }

    throw new Error("AI Judge generation attempts exhausted without a terminal result");
  }

  private createFailedResult(
    attempt: number,
    latestDraft: ReferencedAiJudgeConfiguration | undefined,
    error: unknown,
  ): AiJudgeGenerationResult {
    return {
      status: AI_JUDGE_GENERATION_STATUS.FAILED,
      attempt,
      message: error instanceof Error ? error.message : "Generation failed",
      configuration: latestDraft ? stripAiJudgeConfigurationReferences(latestDraft) : undefined,
    };
  }

  private createEvaluatingEvent(
    attempt: number,
    draft: ReferencedAiJudgeConfiguration,
    changes?: AiJudgeDraftChange[],
  ): AiJudgeGenerationProgressEvent {
    return {
      status: AI_JUDGE_GENERATION_STATUS.EVALUATING,
      attempt,
      draft,
      ...(changes ? { changes } : {}),
    };
  }

  private createCompletedResult(
    attempt: number,
    draft: ReferencedAiJudgeConfiguration,
    validation: AiJudgeConfigurationValidationResult,
    changes?: AiJudgeDraftChange[],
  ): AiJudgeGenerationResult {
    return {
      status: AI_JUDGE_GENERATION_STATUS.COMPLETED,
      attempt,
      configuration: stripAiJudgeConfigurationReferences(draft),
      validation,
      ...(changes ? { changes } : {}),
    };
  }

  private createRevisingEvent(
    attempt: number,
    draft: ReferencedAiJudgeConfiguration,
    validation: AiJudgeConfigurationValidationResult,
    changes?: AiJudgeDraftChange[],
  ): AiJudgeGenerationProgressEvent {
    return {
      status: AI_JUDGE_GENERATION_STATUS.REVISING,
      attempt,
      draft,
      validation,
      ...(changes ? { changes } : {}),
    };
  }

  private getInitialDraft(
    input: StartAiJudgeConfigurationGenerationInput,
  ): ReferencedAiJudgeConfiguration | undefined {
    if (input.mode === AI_JUDGE_GENERATION_MODE.IMPROVE) return input.currentConfiguration;
    return undefined;
  }

  private createRepairInput(
    originalInput: StartAiJudgeConfigurationGenerationInput,
    currentConfiguration: ReferencedAiJudgeConfiguration,
    validation: AiJudgeConfigurationValidationResult,
  ): GenerateAiJudgeConfigurationDraftInput {
    return {
      mode: AI_JUDGE_GENERATION_MODE.REPAIR,
      language: originalInput.language,
      lessonContext: originalInput.lessonContext,
      brief: originalInput.brief,
      currentConfiguration,
      blockingIssues: validation.issues,
    };
  }

  private getRequiresReviewResult(
    attempt: number,
    draft: ReferencedAiJudgeConfiguration,
    validation: AiJudgeConfigurationValidationResult,
    changes?: AiJudgeDraftChange[],
  ): AiJudgeGenerationResult | undefined {
    if (attempt < AI_JUDGE_GENERATION_MAX_ATTEMPTS) return undefined;

    return {
      status: AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW,
      attempt: AI_JUDGE_GENERATION_MAX_ATTEMPTS,
      configuration: stripAiJudgeConfigurationReferences(draft),
      validation,
      ...(changes ? { changes } : {}),
    };
  }

  private async getCancelledResult(
    attempt: number,
    latestDraft: ReferencedAiJudgeConfiguration | undefined,
    options: AiJudgeConfigurationGenerationWorkflowOptions,
  ): Promise<AiJudgeGenerationResult | undefined> {
    if (!(await options.isCancelled?.())) return undefined;

    return {
      status: AI_JUDGE_GENERATION_STATUS.CANCELLED,
      attempt,
      configuration: latestDraft ? stripAiJudgeConfigurationReferences(latestDraft) : undefined,
    };
  }

  private async report<T extends AiJudgeGenerationProgressEvent>(
    progress: T,
    options: AiJudgeConfigurationGenerationWorkflowOptions,
  ): Promise<T> {
    await options.reportProgress?.(progress);
    return progress;
  }
}
