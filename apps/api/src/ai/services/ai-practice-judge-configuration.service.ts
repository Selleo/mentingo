import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";

import type { SupportedLanguages } from "@repo/shared";
import type { AiPracticeJudgeConfigurationGraph } from "src/ai/ai-practice.types";
import type { GeneratedAiJudgeConfiguration } from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import type { UUIDType } from "src/common";

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
      title: buildJsonbField(language, criterion.title),
      expectedBehavior: buildJsonbField(language, criterion.expectedBehavior),
    }));
    const scoreGuidance = data.criteria.flatMap((criterion, criterionIndex) =>
      criterion.scoreGuidance.map((guidance) => ({
        criterionId: criteria[criterionIndex].id,
        score: guidance.score,
        description: buildJsonbField(language, guidance.description),
        example: guidance.example == null ? null : buildJsonbField(language, guidance.example),
      })),
    );
    const blockingErrors = data.blockingErrors.map((blockingError) => ({
      id: randomUUID() as UUIDType,
      configurationId,
      description: buildJsonbField(language, blockingError.description),
    }));

    return {
      configuration: {
        id: configurationId,
        practiceSessionId,
        taskGoal: buildJsonbField(language, data.taskGoal),
        passingThresholdPercent: data.passingThresholdPercent,
      },
      criteria,
      scoreGuidance,
      blockingErrors,
    };
  }
}
