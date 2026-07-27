import { observe, updateActiveObservation } from "@langfuse/tracing";
import { Injectable, Logger } from "@nestjs/common";

import { AI_JUDGE_GENERATION_FAILURE_MESSAGE } from "../ai-judge-configuration-generation.constants";
import {
  AI_JUDGE_GENERATION_MAX_ATTEMPTS,
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_GENERATION_STATUS,
} from "../ai-judge-configuration-generation.types";
import { diffAiJudgeConfigurationDrafts } from "../utils/ai-judge-configuration-diff";
import {
  getDeterministicAiJudgeConfigurationValidation,
  normalizeDuplicateAiJudgeConfigurationReferences,
  stripAiJudgeConfigurationReferences,
} from "../utils/ai-judge-configuration-draft";

import { AiJudgeConfigurationGeneratorService } from "./ai-judge-configuration-generator.service";
import { AiJudgeConfigurationValidatorService } from "./ai-judge-configuration-validator.service";

import type {
  AiJudgeConfigurationGenerationWorkflowOptions,
  RunAiJudgeConfigurationGenerationInput,
} from "./ai-judge-configuration-generation-workflow.types";
import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeDraftChange,
  AiJudgeGenerationAttempt,
  AiJudgeGenerationProgressEvent,
  AiJudgeGenerationResult,
  ReferencedAiJudgeConfiguration,
} from "../schemas/ai-judge-configuration-generation.schema";

@Injectable()
export class AiJudgeConfigurationGenerationWorkflowService {
  private readonly logger = new Logger(AiJudgeConfigurationGenerationWorkflowService.name);

  constructor(
    private readonly aiJudgeConfigurationGeneratorService: AiJudgeConfigurationGeneratorService,
    private readonly aiJudgeConfigurationValidatorService: AiJudgeConfigurationValidatorService,
  ) {}

  async run(
    input: RunAiJudgeConfigurationGenerationInput,
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
    input: RunAiJudgeConfigurationGenerationInput,
    options: AiJudgeConfigurationGenerationWorkflowOptions,
  ): Promise<AiJudgeGenerationResult> {
    const attempt = options.attempt ?? 1;
    const attemptHistory = options.attemptHistory ?? [];
    let latestDraft: ReferencedAiJudgeConfiguration | undefined;
    const cancelledBeforeAttempt = await this.getCancelledResult(
      attempt,
      latestDraft,
      attemptHistory,
      options,
    );
    if (cancelledBeforeAttempt) return this.report(cancelledBeforeAttempt, options);

    await this.report(
      { status: AI_JUDGE_GENERATION_STATUS.DRAFTING, attempt, attemptHistory },
      options,
    );

    const previousDraft = this.getInitialDraft(input);
    let latestChanges: AiJudgeDraftChange[] | undefined;
    try {
      const generatedDraft = await this.aiJudgeConfigurationGeneratorService.generate(input);
      latestDraft = normalizeDuplicateAiJudgeConfigurationReferences(generatedDraft, previousDraft);
      await options.onDraft?.(latestDraft);
      latestChanges = previousDraft
        ? diffAiJudgeConfigurationDrafts(previousDraft, latestDraft)
        : undefined;
    } catch (error) {
      return this.report(
        this.createFailedResult(attempt, latestDraft, attemptHistory, error),
        options,
      );
    }

    const cancelledAfterDraft = await this.getCancelledResult(
      attempt,
      latestDraft,
      attemptHistory,
      options,
    );
    if (cancelledAfterDraft) return this.report(cancelledAfterDraft, options);

    await this.report(
      this.createEvaluatingEvent(attempt, latestDraft, attemptHistory, latestChanges),
      options,
    );
    const deterministicValidation = getDeterministicAiJudgeConfigurationValidation(
      previousDraft,
      latestDraft,
    );
    const validation =
      deterministicValidation ??
      (await this.aiJudgeConfigurationValidatorService.validate({
        language: input.language,
        lessonContext: input.lessonContext,
        configuration: latestDraft,
        brief: input.brief,
        creatorInstruction: this.getCreatorInstruction(input),
        appliedChanges: latestChanges,
        previousValidation: attemptHistory.at(-1)?.validation,
      }));

    const cancelledAfterValidation = await this.getCancelledResult(
      attempt,
      latestDraft,
      attemptHistory,
      options,
    );
    if (cancelledAfterValidation) return this.report(cancelledAfterValidation, options);

    const completedAttempt = this.createAttempt(attempt, validation, latestChanges);
    const nextAttemptHistory = [...attemptHistory, completedAttempt];

    if (validation.passed)
      return this.report(
        this.createCompletedResult(
          attempt,
          latestDraft,
          validation,
          nextAttemptHistory,
          latestChanges,
        ),
        options,
      );

    const terminalResult = this.getRequiresReviewResult(
      attempt,
      latestDraft,
      validation,
      nextAttemptHistory,
      latestChanges,
    );
    if (terminalResult) return this.report(terminalResult, options);

    return this.report(
      this.createAwaitingRevisionResult(
        attempt,
        latestDraft,
        validation,
        nextAttemptHistory,
        latestChanges,
      ),
      options,
    );
  }

  private createFailedResult(
    attempt: number,
    latestDraft: ReferencedAiJudgeConfiguration | undefined,
    attemptHistory: AiJudgeGenerationAttempt[],
    error: unknown,
  ): AiJudgeGenerationResult {
    const message = error instanceof Error ? error.message : "Unknown generation error";
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(
      `AI Judge configuration generation attempt ${attempt} failed: ${message}`,
      stack,
    );

    return {
      status: AI_JUDGE_GENERATION_STATUS.FAILED,
      attempt,
      message: AI_JUDGE_GENERATION_FAILURE_MESSAGE,
      attemptHistory,
      configuration: latestDraft ? stripAiJudgeConfigurationReferences(latestDraft) : undefined,
    };
  }

  private createEvaluatingEvent(
    attempt: number,
    draft: ReferencedAiJudgeConfiguration,
    attemptHistory: AiJudgeGenerationAttempt[],
    changes?: AiJudgeDraftChange[],
  ): AiJudgeGenerationProgressEvent {
    return {
      status: AI_JUDGE_GENERATION_STATUS.EVALUATING,
      attempt,
      draft,
      attemptHistory,
      ...(changes ? { changes } : {}),
    };
  }

  private createCompletedResult(
    attempt: number,
    draft: ReferencedAiJudgeConfiguration,
    validation: AiJudgeConfigurationValidationResult,
    attemptHistory: AiJudgeGenerationAttempt[],
    changes?: AiJudgeDraftChange[],
  ): AiJudgeGenerationResult {
    return {
      status: AI_JUDGE_GENERATION_STATUS.COMPLETED,
      attempt,
      configuration: stripAiJudgeConfigurationReferences(draft),
      validation,
      attemptHistory,
      ...(changes ? { changes } : {}),
    };
  }

  private getInitialDraft(
    input: RunAiJudgeConfigurationGenerationInput,
  ): ReferencedAiJudgeConfiguration | undefined {
    if (input.mode !== AI_JUDGE_GENERATION_MODE.CREATE) return input.currentConfiguration;
    return undefined;
  }

  private getCreatorInstruction(input: RunAiJudgeConfigurationGenerationInput): string | undefined {
    if (input.creatorInstruction) return input.creatorInstruction;
    if (input.mode === AI_JUDGE_GENERATION_MODE.IMPROVE) return input.instruction;
    return undefined;
  }

  private createAwaitingRevisionResult(
    attempt: number,
    draft: ReferencedAiJudgeConfiguration,
    validation: AiJudgeConfigurationValidationResult,
    attemptHistory: AiJudgeGenerationAttempt[],
    changes?: AiJudgeDraftChange[],
  ): AiJudgeGenerationResult {
    return {
      status: AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION,
      attempt,
      configuration: stripAiJudgeConfigurationReferences(draft),
      validation,
      attemptHistory,
      ...(changes ? { changes } : {}),
    };
  }

  private getRequiresReviewResult(
    attempt: number,
    draft: ReferencedAiJudgeConfiguration,
    validation: AiJudgeConfigurationValidationResult,
    attemptHistory: AiJudgeGenerationAttempt[],
    changes?: AiJudgeDraftChange[],
  ): AiJudgeGenerationResult | undefined {
    if (attempt < AI_JUDGE_GENERATION_MAX_ATTEMPTS) return undefined;

    return {
      status: AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW,
      attempt: AI_JUDGE_GENERATION_MAX_ATTEMPTS,
      configuration: stripAiJudgeConfigurationReferences(draft),
      validation,
      attemptHistory,
      ...(changes ? { changes } : {}),
    };
  }

  private async getCancelledResult(
    attempt: number,
    latestDraft: ReferencedAiJudgeConfiguration | undefined,
    attemptHistory: AiJudgeGenerationAttempt[],
    options: AiJudgeConfigurationGenerationWorkflowOptions,
  ): Promise<AiJudgeGenerationResult | undefined> {
    if (!(await options.isCancelled?.())) return undefined;

    return {
      status: AI_JUDGE_GENERATION_STATUS.CANCELLED,
      attempt,
      attemptHistory,
      configuration: latestDraft ? stripAiJudgeConfigurationReferences(latestDraft) : undefined,
    };
  }

  private createAttempt(
    attempt: number,
    validation: AiJudgeConfigurationValidationResult,
    changes?: AiJudgeDraftChange[],
  ): AiJudgeGenerationAttempt {
    return {
      attempt,
      changes: changes ?? [],
      validation,
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
