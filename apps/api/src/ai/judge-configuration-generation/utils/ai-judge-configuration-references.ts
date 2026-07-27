import type {
  AiJudgeConfigurationIdentityMap,
  ReferencedAiJudgeConfigurationContext,
} from "./ai-judge-configuration-references.types";
import type { ReferencedAiJudgeConfiguration } from "../schemas/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationInput } from "src/lesson/ai-judge-configuration/ai-judge-configuration.schema";

export const referenceAiJudgeConfiguration = (
  configuration: AiJudgeConfigurationInput,
): ReferencedAiJudgeConfigurationContext => {
  const identities: AiJudgeConfigurationIdentityMap = {
    criteria: [],
    blockingErrors: [],
  };

  const criteria = configuration.criteria.map((criterion, criterionIndex) => {
    const ref = `C${criterionIndex + 1}`;
    const { id, scoreGuidance, ...content } = criterion;

    identities.criteria.push({
      ref,
      ...(id ? { id } : {}),
      scoreGuidance: scoreGuidance.map((guidance) => ({
        score: guidance.score,
        ...(guidance.id ? { id: guidance.id } : {}),
      })),
    });

    return {
      ref,
      ...content,
      scoreGuidance: scoreGuidance.map(({ id: _id, ...guidance }) => guidance),
    };
  });

  const blockingErrors = configuration.blockingErrors.map((blockingError, blockingErrorIndex) => {
    const ref = `B${blockingErrorIndex + 1}`;
    const { id, ...content } = blockingError;

    identities.blockingErrors.push({ ref, ...(id ? { id } : {}) });

    return { ref, ...content };
  });

  return {
    configuration: {
      taskGoal: configuration.taskGoal,
      passingThresholdPercent: configuration.passingThresholdPercent,
      criteria,
      blockingErrors,
    },
    identities,
  };
};

export const reconcileAiJudgeConfigurationDraft = (
  configuration: ReferencedAiJudgeConfiguration,
  identities: AiJudgeConfigurationIdentityMap,
): AiJudgeConfigurationInput => {
  assertUniqueReferences(configuration);

  const criterionIdentities = new Map(
    identities.criteria.map((identity) => [identity.ref, identity]),
  );
  const blockingErrorIdentities = new Map(
    identities.blockingErrors.map((identity) => [identity.ref, identity]),
  );

  return {
    taskGoal: configuration.taskGoal,
    passingThresholdPercent: configuration.passingThresholdPercent,
    criteria: configuration.criteria.map(({ ref, scoreGuidance, ...criterion }) => {
      const identity = criterionIdentities.get(ref);
      const guidanceIdentities = new Map(
        identity?.scoreGuidance.map((guidance) => [guidance.score, guidance.id]),
      );

      return {
        ...(identity?.id ? { id: identity.id } : {}),
        ...criterion,
        scoreGuidance: scoreGuidance.map((guidance) => {
          const id = guidanceIdentities.get(guidance.score);

          return { ...(id ? { id } : {}), ...guidance };
        }),
      };
    }),
    blockingErrors: configuration.blockingErrors.map(({ ref, ...blockingError }) => {
      const id = blockingErrorIdentities.get(ref)?.id;

      return { ...(id ? { id } : {}), ...blockingError };
    }),
  };
};

const assertUniqueReferences = (configuration: ReferencedAiJudgeConfiguration) => {
  assertUnique(
    configuration.criteria.map(({ ref }) => ref),
    "criterion",
  );
  assertUnique(
    configuration.blockingErrors.map(({ ref }) => ref),
    "blocking error",
  );
};

const assertUnique = (references: string[], label: string) => {
  const uniqueReferences = new Set(references);
  if (uniqueReferences.size !== references.length)
    throw new Error(`Cannot reconcile configuration with duplicate ${label} references`);
};
