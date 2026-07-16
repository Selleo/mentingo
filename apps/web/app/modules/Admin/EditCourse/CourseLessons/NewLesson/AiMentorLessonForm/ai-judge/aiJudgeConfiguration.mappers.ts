import type { AiJudgeConfigurationDraft } from "./aiJudgeConfiguration.types";
import type {
  GetConfigurationResponse,
  ReplaceConfigurationBody,
  UpdateTranslationsBody,
} from "~/api/generated-api";

type AiJudgeConfigurationResponse = NonNullable<GetConfigurationResponse["data"]>;

const requirePersistedId = (id: string | undefined, entity: string) => {
  if (!id) throw new Error(`Missing persisted AI Judge ${entity} ID`);
  return id;
};

export const mapAiJudgeConfigurationResponseToDraft = (
  configuration: AiJudgeConfigurationResponse,
): AiJudgeConfigurationDraft => ({
  id: configuration.id,
  taskGoal: configuration.taskGoal,
  passingThresholdPercent: configuration.passingThresholdPercent,
  criteria: configuration.criteria.map((criterion) => ({
    id: criterion.id,
    title: criterion.title,
    expectedBehavior: criterion.expectedBehavior,
    maxScore: criterion.maxScore,
    scoreGuidance: criterion.scoreGuidance.map((guidance) => ({
      id: guidance.id,
      score: guidance.score,
      description: guidance.description,
      example: guidance.example ?? undefined,
    })),
  })),
  blockingErrors: configuration.blockingErrors.map((blockingError) => ({
    id: blockingError.id,
    description: blockingError.description,
  })),
});

export const mapAiJudgeConfigurationDraftToBaseInput = (
  configuration: AiJudgeConfigurationDraft,
): ReplaceConfigurationBody => ({
  taskGoal: configuration.taskGoal,
  passingThresholdPercent: configuration.passingThresholdPercent,
  criteria: configuration.criteria.map((criterion) => ({
    id: criterion.id,
    title: criterion.title,
    expectedBehavior: criterion.expectedBehavior,
    maxScore: criterion.maxScore,
    scoreGuidance: criterion.scoreGuidance.map((guidance) => ({
      id: guidance.id,
      score: guidance.score,
      description: guidance.description,
      example: guidance.example,
    })),
  })),
  blockingErrors: configuration.blockingErrors.map((blockingError) => ({
    id: blockingError.id,
    description: blockingError.description,
  })),
});

export const mapAiJudgeConfigurationDraftToTranslationInput = (
  configuration: AiJudgeConfigurationDraft,
): UpdateTranslationsBody => ({
  taskGoal: configuration.taskGoal,
  criteria: configuration.criteria.map((criterion) => ({
    id: requirePersistedId(criterion.id, "criterion"),
    title: criterion.title,
    expectedBehavior: criterion.expectedBehavior,
  })),
  scoreGuidance: configuration.criteria.flatMap((criterion) =>
    criterion.scoreGuidance.map((guidance) => ({
      id: requirePersistedId(guidance.id, "score guidance"),
      description: guidance.description,
      example: guidance.example,
    })),
  ),
  blockingErrors: configuration.blockingErrors.map((blockingError) => ({
    id: requirePersistedId(blockingError.id, "blocking error"),
    description: blockingError.description,
  })),
});
