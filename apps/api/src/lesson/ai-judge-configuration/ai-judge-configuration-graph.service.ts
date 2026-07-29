import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";

import { validateAiJudgeConfigurationContent } from "./ai-judge-configuration-content-validator";
import { AI_JUDGE_CONTENT_VALIDATION_CODE } from "./ai-judge-configuration-content-validator.types";
import { AiJudgeConfigurationRepository } from "./ai-judge-configuration.repository";

import type {
  AiJudgeConfigurationInput,
  AiJudgeCriterionInput,
} from "./ai-judge-configuration.schema";
import type { AiJudgeConfigurationGraph } from "./ai-judge-configuration.types";
import type { SupportedLanguages } from "@repo/shared";

const contentValidationErrorKeys = {
  [AI_JUDGE_CONTENT_VALIDATION_CODE.GUIDANCE_SCORE_OUT_OF_RANGE]:
    "aiJudgeConfiguration.errors.guidanceExceedsMaximum",
  [AI_JUDGE_CONTENT_VALIDATION_CODE.DUPLICATE_GUIDANCE_SCORE]:
    "aiJudgeConfiguration.errors.duplicateGuidanceScore",
  [AI_JUDGE_CONTENT_VALIDATION_CODE.MISSING_GUIDANCE_SCORES]:
    "adminCourseView.curriculum.lesson.aiJudge.validation.completeGuidanceRequired",
} as const;

@Injectable()
export class AiJudgeConfigurationGraphService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly aiJudgeConfigurationRepository: AiJudgeConfigurationRepository,
  ) {}

  async createConfiguration(
    aiMentorLessonId: UUIDType,
    data: AiJudgeConfigurationInput,
    baseLanguage: SupportedLanguages,
  ): Promise<UUIDType> {
    return this.db.transaction((transaction) =>
      this.createConfigurationInTransaction(aiMentorLessonId, data, baseLanguage, transaction),
    );
  }

  async createConfigurationInTransaction(
    aiMentorLessonId: UUIDType,
    data: AiJudgeConfigurationInput,
    baseLanguage: SupportedLanguages,
    transaction: DatabasePg,
  ): Promise<UUIDType> {
    this.validateGraph(data);
    this.validateCreateInput(data);

    const configuration = await this.aiJudgeConfigurationRepository.createConfiguration(
      aiMentorLessonId,
      data,
      baseLanguage,
      transaction,
    );

    for (const criterionData of data.criteria) {
      const { scoreGuidance, ...criterionFields } = criterionData;
      const criterion = await this.aiJudgeConfigurationRepository.createCriterion(
        configuration.id,
        criterionFields,
        baseLanguage,
        transaction,
      );

      for (const guidanceData of scoreGuidance)
        await this.aiJudgeConfigurationRepository.createScoreGuidance(
          criterion.id,
          guidanceData,
          baseLanguage,
          transaction,
        );
    }

    for (const blockingErrorData of data.blockingErrors)
      await this.aiJudgeConfigurationRepository.createBlockingError(
        configuration.id,
        blockingErrorData,
        baseLanguage,
        transaction,
      );

    return configuration.id;
  }

  async updateConfiguration(
    configurationId: UUIDType,
    data: AiJudgeConfigurationInput,
    baseLanguage: SupportedLanguages,
  ): Promise<UUIDType> {
    this.validateGraph(data);

    return this.db.transaction(async (transaction) => {
      const existingGraph = await this.aiJudgeConfigurationRepository.getConfigurationGraph(
        configurationId,
        transaction,
      );

      if (!existingGraph)
        throw new NotFoundException("aiJudgeConfiguration.errors.configurationNotFound");

      this.validateUpdateInput(data, existingGraph);

      await this.aiJudgeConfigurationRepository.updateConfiguration(
        configurationId,
        data,
        baseLanguage,
        transaction,
      );
      await this.syncCriteria(
        configurationId,
        data.criteria,
        existingGraph,
        baseLanguage,
        transaction,
      );
      await this.syncBlockingErrors(
        configurationId,
        data,
        existingGraph,
        baseLanguage,
        transaction,
      );

      return configurationId;
    });
  }

  private async syncCriteria(
    configurationId: UUIDType,
    criteria: AiJudgeCriterionInput[],
    existingGraph: AiJudgeConfigurationGraph,
    baseLanguage: SupportedLanguages,
    transaction: DatabasePg,
  ) {
    const retainedCriterionIds = new Set<UUIDType>();

    for (const criterionData of criteria) {
      const { id, scoreGuidance, ...criterionFields } = criterionData;
      const criterion = id
        ? await this.aiJudgeConfigurationRepository.updateCriterion(
            configurationId,
            id,
            criterionFields,
            baseLanguage,
            transaction,
          )
        : await this.aiJudgeConfigurationRepository.createCriterion(
            configurationId,
            criterionFields,
            baseLanguage,
            transaction,
          );

      retainedCriterionIds.add(criterion.id);
      await this.syncScoreGuidance(
        criterion.id,
        scoreGuidance,
        existingGraph,
        baseLanguage,
        transaction,
      );
    }

    const criterionIdsToDelete = existingGraph.criteria
      .map(({ id }) => id)
      .filter((id) => !retainedCriterionIds.has(id));

    await this.aiJudgeConfigurationRepository.deleteCriteria(
      configurationId,
      criterionIdsToDelete,
      transaction,
    );
  }

  private async syncScoreGuidance(
    criterionId: UUIDType,
    scoreGuidance: AiJudgeCriterionInput["scoreGuidance"],
    existingGraph: AiJudgeConfigurationGraph,
    baseLanguage: SupportedLanguages,
    transaction: DatabasePg,
  ) {
    const existingGuidance = existingGraph.scoreGuidance.filter(
      (guidance) => guidance.criterionId === criterionId,
    );
    const retainedGuidanceIds = scoreGuidance.flatMap(({ id }) => (id ? [id] : []));
    const retainedGuidanceIdSet = new Set(retainedGuidanceIds);
    const guidanceIdsToDelete = existingGuidance
      .map(({ id }) => id)
      .filter((id) => !retainedGuidanceIdSet.has(id));

    await this.aiJudgeConfigurationRepository.deleteScoreGuidance(guidanceIdsToDelete, transaction);
    await this.aiJudgeConfigurationRepository.stageScoreGuidanceScores(
      retainedGuidanceIds,
      transaction,
    );

    for (const guidanceData of scoreGuidance) {
      const { id, ...guidanceFields } = guidanceData;
      if (id)
        await this.aiJudgeConfigurationRepository.updateScoreGuidance(
          id,
          guidanceFields,
          baseLanguage,
          transaction,
        );
      else
        await this.aiJudgeConfigurationRepository.createScoreGuidance(
          criterionId,
          guidanceFields,
          baseLanguage,
          transaction,
        );
    }
  }

  private async syncBlockingErrors(
    configurationId: UUIDType,
    data: AiJudgeConfigurationInput,
    existingGraph: AiJudgeConfigurationGraph,
    baseLanguage: SupportedLanguages,
    transaction: DatabasePg,
  ) {
    const retainedBlockingErrorIds = new Set<UUIDType>();

    for (const blockingErrorData of data.blockingErrors) {
      const { id, ...blockingErrorFields } = blockingErrorData;
      if (id) {
        await this.aiJudgeConfigurationRepository.updateBlockingError(
          configurationId,
          id,
          blockingErrorFields,
          baseLanguage,
          transaction,
        );
        retainedBlockingErrorIds.add(id);
        continue;
      }

      const blockingError = await this.aiJudgeConfigurationRepository.createBlockingError(
        configurationId,
        blockingErrorFields,
        baseLanguage,
        transaction,
      );
      retainedBlockingErrorIds.add(blockingError.id);
    }

    const blockingErrorIdsToDelete = existingGraph.blockingErrors
      .map(({ id }) => id)
      .filter((id) => !retainedBlockingErrorIds.has(id));

    await this.aiJudgeConfigurationRepository.deleteBlockingErrors(
      configurationId,
      blockingErrorIdsToDelete,
      transaction,
    );
  }

  private validateGraph(data: AiJudgeConfigurationInput) {
    this.assertUniqueIds(data.criteria.flatMap(({ id }) => (id ? [id] : [])));
    this.assertUniqueIds(data.blockingErrors.flatMap(({ id }) => (id ? [id] : [])));

    for (const criterion of data.criteria)
      this.assertUniqueIds(criterion.scoreGuidance.flatMap(({ id }) => (id ? [id] : [])));

    const [contentIssue] = validateAiJudgeConfigurationContent(data);
    if (contentIssue) throw new BadRequestException(contentValidationErrorKeys[contentIssue.code]);
  }

  private validateCreateInput(data: AiJudgeConfigurationInput) {
    const hasIds =
      data.criteria.some(({ id }) => id !== undefined) ||
      data.criteria.some(({ scoreGuidance }) => scoreGuidance.some(({ id }) => id !== undefined)) ||
      data.blockingErrors.some(({ id }) => id !== undefined);

    if (hasIds) throw new BadRequestException("aiJudgeConfiguration.errors.idNotAllowedOnCreate");
  }

  private validateUpdateInput(
    data: AiJudgeConfigurationInput,
    existingGraph: AiJudgeConfigurationGraph,
  ) {
    const existingCriteria = new Set(existingGraph.criteria.map(({ id }) => id));
    const existingGuidanceById = new Map(
      existingGraph.scoreGuidance.map((guidance) => [guidance.id, guidance]),
    );
    const existingBlockingErrors = new Set(existingGraph.blockingErrors.map(({ id }) => id));

    for (const criterion of data.criteria) {
      if (criterion.id && !existingCriteria.has(criterion.id))
        throw new BadRequestException("aiJudgeConfiguration.errors.criterionNotFound");

      for (const guidance of criterion.scoreGuidance) {
        if (!guidance.id) continue;
        const existingGuidance = existingGuidanceById.get(guidance.id);
        if (!existingGuidance || existingGuidance.criterionId !== criterion.id)
          throw new BadRequestException("aiJudgeConfiguration.errors.guidanceNotFound");
      }
    }

    for (const blockingError of data.blockingErrors)
      if (blockingError.id && !existingBlockingErrors.has(blockingError.id))
        throw new BadRequestException("aiJudgeConfiguration.errors.blockingErrorNotFound");
  }

  private assertUniqueIds(ids: UUIDType[]) {
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException("aiJudgeConfiguration.errors.duplicateId");
  }
}
