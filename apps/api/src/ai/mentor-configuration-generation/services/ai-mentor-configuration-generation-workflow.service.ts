import { observe, updateActiveObservation } from "@langfuse/tracing";
import { Injectable, Logger } from "@nestjs/common";
import {
  AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS,
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
} from "@repo/shared";

import { AI_MENTOR_CONFIGURATION_GENERATION_FAILURE_MESSAGE } from "../ai-mentor-configuration-generation.constants";
import { diffAiMentorConfigurationDrafts } from "../utils/ai-mentor-configuration-diff";
import { getDeterministicAiMentorConfigurationValidation } from "../utils/ai-mentor-configuration-draft";

import { AiMentorConfigurationGeneratorService } from "./ai-mentor-configuration-generator.service";
import { AiMentorConfigurationValidatorService } from "./ai-mentor-configuration-validator.service";

import type {
  AiMentorConfigurationGenerationWorkflowOptions,
  RunAiMentorConfigurationGenerationInput,
} from "./ai-mentor-configuration-generation-workflow.types";
import type {
  AiMentorConfigurationDraftChange,
  AiMentorConfigurationGenerationAttempt,
  AiMentorConfigurationGenerationProgressEvent,
  AiMentorConfigurationGenerationResult,
} from "../schemas/ai-mentor-configuration-generation.schema";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

@Injectable()
export class AiMentorConfigurationGenerationWorkflowService {
  private readonly logger = new Logger(AiMentorConfigurationGenerationWorkflowService.name);

  constructor(
    private readonly generatorService: AiMentorConfigurationGeneratorService,
    private readonly validatorService: AiMentorConfigurationValidatorService,
  ) {}

  async run(
    input: RunAiMentorConfigurationGenerationInput,
    options: AiMentorConfigurationGenerationWorkflowOptions = {},
  ): Promise<AiMentorConfigurationGenerationResult> {
    return observe(
      async () => {
        const result = await this.runAttempt(input, options);
        updateActiveObservation({
          input: { mode: input.mode, configurationType: input.configurationType },
          output: result,
        });
        return result;
      },
      { name: "AI Mentor Configuration Generation Workflow", asType: "chain" },
    )();
  }

  private async runAttempt(
    input: RunAiMentorConfigurationGenerationInput,
    options: AiMentorConfigurationGenerationWorkflowOptions,
  ): Promise<AiMentorConfigurationGenerationResult> {
    const attempt = options.attempt ?? 1;
    const attemptHistory = options.attemptHistory ?? [];
    let latestDraft: AiMentorConfigurationContent | undefined;

    if (await options.isCancelled?.())
      return this.report(
        {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.CANCELLED,
          attempt,
          attemptHistory,
        },
        options,
      );

    await this.report(
      {
        status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
        attempt,
        attemptHistory,
      },
      options,
    );

    const previousDraft =
      input.mode === AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE
        ? undefined
        : input.currentConfiguration;
    let changes: AiMentorConfigurationDraftChange[] | undefined;

    try {
      latestDraft = await this.generatorService.generate(input);
      if (latestDraft.type !== input.configurationType)
        throw new Error("Generated AI Mentor configuration type changed unexpectedly");
      await options.onDraft?.(latestDraft);
      changes = previousDraft
        ? diffAiMentorConfigurationDrafts(previousDraft, latestDraft)
        : undefined;
    } catch (error) {
      return this.report(this.failed(attempt, attemptHistory, latestDraft, error), options);
    }

    if (await options.isCancelled?.())
      return this.report(
        {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.CANCELLED,
          attempt,
          attemptHistory,
          configuration: latestDraft,
        },
        options,
      );

    await this.report(
      {
        status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.EVALUATING,
        attempt,
        attemptHistory,
        draft: latestDraft,
        ...(changes ? { changes } : {}),
      },
      options,
    );

    const deterministicValidation = getDeterministicAiMentorConfigurationValidation(latestDraft);
    const validation =
      deterministicValidation ??
      (await this.validatorService.validate({
        language: input.language,
        lessonContext: input.lessonContext,
        configuration: latestDraft,
        brief: input.brief,
        creatorInstruction: this.getCreatorInstruction(input),
        appliedChanges: changes,
        previousValidation: attemptHistory.at(-1)?.validation,
      }));

    if (await options.isCancelled?.())
      return this.report(
        {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.CANCELLED,
          attempt,
          attemptHistory,
          configuration: latestDraft,
        },
        options,
      );

    const nextHistory = [...attemptHistory, { attempt, changes: changes ?? [], validation }];

    if (validation.passed)
      return this.report(
        {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.COMPLETED,
          attempt,
          configuration: latestDraft,
          validation,
          attemptHistory: nextHistory,
          ...(changes ? { changes } : {}),
        },
        options,
      );

    if (attempt >= AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS)
      return this.report(
        {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REQUIRES_REVIEW,
          attempt: AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS,
          configuration: latestDraft,
          validation,
          attemptHistory: nextHistory,
          ...(changes ? { changes } : {}),
        },
        options,
      );

    return this.report(
      {
        status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION,
        attempt,
        configuration: latestDraft,
        validation,
        attemptHistory: nextHistory,
        ...(changes ? { changes } : {}),
      },
      options,
    );
  }

  private getCreatorInstruction(
    input: RunAiMentorConfigurationGenerationInput,
  ): string | undefined {
    if (input.creatorInstruction) return input.creatorInstruction;
    if (input.mode === AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE) return input.instruction;
    return undefined;
  }

  private failed(
    attempt: number,
    attemptHistory: AiMentorConfigurationGenerationAttempt[],
    latestDraft: AiMentorConfigurationContent | undefined,
    error: unknown,
  ): AiMentorConfigurationGenerationResult {
    const message = error instanceof Error ? error.message : "Unknown generation error";
    this.logger.error(
      `AI Mentor configuration generation attempt ${attempt} failed: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );

    return {
      status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED,
      attempt,
      attemptHistory,
      message: AI_MENTOR_CONFIGURATION_GENERATION_FAILURE_MESSAGE,
      ...(latestDraft ? { configuration: latestDraft } : {}),
    };
  }

  private async report<T extends AiMentorConfigurationGenerationProgressEvent>(
    progress: T,
    options: AiMentorConfigurationGenerationWorkflowOptions,
  ): Promise<T> {
    await options.reportProgress?.(progress);
    return progress;
  }
}
