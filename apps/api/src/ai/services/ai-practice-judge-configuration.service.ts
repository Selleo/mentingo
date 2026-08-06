import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import type { SupportedLanguages } from "@repo/shared";
import type { AiPracticeJudgeConfigurationGraph } from "src/ai/ai-practice.types";
import type { GeneratedAiJudgeConfiguration } from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import type { UUIDType } from "src/common";

const buildLocalizedField = (
  language: SupportedLanguages,
  value: string,
): Partial<Record<SupportedLanguages, string>> => ({ [language]: value });

@Injectable()
export class AiPracticeJudgeConfigurationService {
  build(
    practiceSessionId: UUIDType,
    data: GeneratedAiJudgeConfiguration,
    language: SupportedLanguages,
  ): AiPracticeJudgeConfigurationGraph {
    const configurationId = randomUUID() as UUIDType;

    const criteria = data.criteria.map((criterion) => ({
      id: randomUUID() as UUIDType,
      configurationId,
      maxScore: criterion.maxScore,
      title: buildLocalizedField(language, criterion.title),
      expectedBehavior: buildLocalizedField(language, criterion.expectedBehavior),
    }));
    const scoreGuidance = data.criteria.flatMap((criterion, criterionIndex) =>
      criterion.scoreGuidance.map((guidance) => ({
        criterionId: criteria[criterionIndex].id,
        score: guidance.score,
        description: buildLocalizedField(language, guidance.description),
        example: guidance.example == null ? null : buildLocalizedField(language, guidance.example),
      })),
    );
    const blockingErrors = data.blockingErrors.map((blockingError) => ({
      id: randomUUID() as UUIDType,
      configurationId,
      description: buildLocalizedField(language, blockingError.description),
    }));

    return {
      configuration: {
        id: configurationId,
        practiceSessionId,
        taskGoal: buildLocalizedField(language, data.taskGoal),
        passingThresholdPercent: data.passingThresholdPercent,
      },
      criteria,
      scoreGuidance,
      blockingErrors,
    };
  }
}
