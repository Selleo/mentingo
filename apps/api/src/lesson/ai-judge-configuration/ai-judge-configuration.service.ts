import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { COURSE_FEATURE, ENTITY_TYPES, LESSON_TYPES, type SupportedLanguages } from "@repo/shared";

import { DatabasePg, type UUIDType } from "src/common";
import { CourseFeaturePolicyService } from "src/courses/course-feature-policy.service";
import { MasterCourseService } from "src/courses/master-course.service";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { DB } from "src/storage/db/db.providers";

import { AiJudgeConfigurationGraphService } from "./ai-judge-configuration-graph.service";
import { AiJudgeConfigurationTranslationService } from "./ai-judge-configuration-translation.service";
import { AiJudgeConfigurationRepository } from "./ai-judge-configuration.repository";

import type {
  AiJudgeConfigurationInput,
  AiJudgeConfigurationResponse,
  UpdateAiJudgeConfigurationTranslationBody,
} from "./ai-judge-configuration.schema";
import type {
  AiJudgeGenerationAuthoringContext,
  AiJudgeScoreGuidanceLanguageRead,
  AiMentorLessonContext,
  ConfiguredAiJudgeLessonContext,
} from "./ai-judge-configuration.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AiJudgeConfigurationService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly aiJudgeConfigurationRepository: AiJudgeConfigurationRepository,
    private readonly aiJudgeConfigurationGraphService: AiJudgeConfigurationGraphService,
    private readonly aiJudgeConfigurationTranslationService: AiJudgeConfigurationTranslationService,
    private readonly adminLessonService: AdminLessonService,
    private readonly masterCourseService: MasterCourseService,
    private readonly courseFeaturePolicyService: CourseFeaturePolicyService,
  ) {}

  async getConfiguration(
    lessonId: UUIDType,
    currentUser: CurrentUserType,
    requestedLanguage?: SupportedLanguages,
  ): Promise<AiJudgeConfigurationResponse | null> {
    await this.adminLessonService.validateAccess(ENTITY_TYPES.LESSON, currentUser, lessonId);
    const context = await this.getAiMentorLessonContext(lessonId);

    if (!context.configurationId) return null;

    return this.buildResponse(
      { ...context, configurationId: context.configurationId },
      requestedLanguage,
    );
  }

  async replaceConfiguration(
    lessonId: UUIDType,
    data: AiJudgeConfigurationInput,
    currentUser: CurrentUserType,
  ): Promise<AiJudgeConfigurationResponse> {
    const context = await this.prepareStructuralWrite(lessonId, currentUser);
    let configurationId: UUIDType;

    if (context.configurationId)
      configurationId = await this.aiJudgeConfigurationGraphService.updateConfiguration(
        context.configurationId,
        data,
        context.baseLanguage,
      );
    else
      configurationId = await this.aiJudgeConfigurationGraphService.createConfiguration(
        context.aiMentorLessonId,
        data,
        context.baseLanguage,
      );

    return this.buildResponse({ ...context, configurationId }, context.baseLanguage);
  }

  async prepareGenerationAuthoringContext(
    courseId: UUIDType,
    lessonId: UUIDType | undefined,
    currentUser: CurrentUserType,
  ): Promise<AiJudgeGenerationAuthoringContext> {
    if (lessonId) {
      const context = await this.prepareStructuralWrite(lessonId, currentUser);
      if (context.courseId !== courseId)
        throw new NotFoundException("adminCourseView.errors.notFound.lesson");

      return { courseId: context.courseId, baseLanguage: context.baseLanguage };
    }

    await this.masterCourseService.assertCourseContentEditable(courseId);
    await this.courseFeaturePolicyService.assertCourseFeatureEnabled(
      courseId,
      COURSE_FEATURE.CURRICULUM_EDITING,
    );
    await this.adminLessonService.validateAccess(ENTITY_TYPES.COURSE, currentUser, courseId);

    const context = await this.aiJudgeConfigurationRepository.findCourseAuthoringContext(courseId);
    if (!context) throw new NotFoundException("adminCourseView.errors.notFound.course");

    return context;
  }

  async updateTranslations(
    lessonId: UUIDType,
    language: SupportedLanguages,
    data: UpdateAiJudgeConfigurationTranslationBody,
    currentUser: CurrentUserType,
  ): Promise<AiJudgeConfigurationResponse> {
    const context = await this.prepareConfiguredStructuralWrite(lessonId, currentUser);

    if (!context.availableLocales.includes(language))
      throw new BadRequestException("adminCourseView.toast.languageNotSupported");
    if (language === context.baseLanguage)
      throw new BadRequestException(
        "aiJudgeConfiguration.errors.translationRequiresNonBaseLanguage",
      );

    await this.db.transaction(async (trx) => {
      if (data.taskGoal !== undefined)
        await this.aiJudgeConfigurationRepository.updateTaskGoalTranslation(
          context.configurationId,
          language,
          data.taskGoal,
          trx,
        );

      for (const criterionData of data.criteria ?? []) {
        const { id, ...fields } = criterionData;
        const criterion = await this.aiJudgeConfigurationRepository.updateCriterionTranslation(
          context.configurationId,
          id,
          language,
          fields,
          trx,
        );

        if (!criterion)
          throw new NotFoundException("aiJudgeConfiguration.errors.criterionNotFound");
      }

      for (const guidanceData of data.scoreGuidance ?? []) {
        const { id, ...fields } = guidanceData;
        const guidance = await this.aiJudgeConfigurationRepository.updateScoreGuidanceTranslation(
          context.configurationId,
          id,
          language,
          fields,
          trx,
        );

        if (!guidance) throw new NotFoundException("aiJudgeConfiguration.errors.guidanceNotFound");
      }

      for (const blockingErrorData of data.blockingErrors ?? []) {
        const blockingError =
          await this.aiJudgeConfigurationRepository.updateBlockingErrorTranslation(
            context.configurationId,
            blockingErrorData.id,
            language,
            blockingErrorData.description,
            trx,
          );

        if (!blockingError)
          throw new NotFoundException("aiJudgeConfiguration.errors.blockingErrorNotFound");
      }
    });

    return this.buildResponse(context, language);
  }

  private async prepareStructuralWrite(lessonId: UUIDType, currentUser: CurrentUserType) {
    await this.masterCourseService.assertCourseContentEditableByLessonId(lessonId);
    await this.courseFeaturePolicyService.assertCourseFeatureEnabledByLessonId(
      lessonId,
      COURSE_FEATURE.CURRICULUM_EDITING,
    );
    await this.adminLessonService.validateAccess(ENTITY_TYPES.LESSON, currentUser, lessonId);

    return this.getAiMentorLessonContext(lessonId);
  }

  private async prepareConfiguredStructuralWrite(lessonId: UUIDType, currentUser: CurrentUserType) {
    const context = await this.prepareStructuralWrite(lessonId, currentUser);

    if (!context.configurationId)
      throw new NotFoundException("aiJudgeConfiguration.errors.configurationNotFound");

    return { ...context, configurationId: context.configurationId };
  }

  private async getAiMentorLessonContext(lessonId: UUIDType): Promise<AiMentorLessonContext> {
    const context = await this.aiJudgeConfigurationRepository.findLessonContext(lessonId);

    if (!context) throw new NotFoundException("adminCourseView.errors.notFound.lesson");
    if (context.lessonType !== LESSON_TYPES.AI_MENTOR || !context.aiMentorLessonId)
      throw new BadRequestException("aiJudgeConfiguration.errors.invalidLessonType");

    return { ...context, aiMentorLessonId: context.aiMentorLessonId };
  }

  private async buildResponse(
    context: ConfiguredAiJudgeLessonContext,
    requestedLanguage?: SupportedLanguages,
  ): Promise<AiJudgeConfigurationResponse> {
    const language = this.resolveLanguage(context, requestedLanguage);
    const [configuration] = await this.aiJudgeConfigurationRepository.getConfigurationInLanguage(
      context.configurationId,
      language,
    );

    if (!configuration)
      throw new NotFoundException("aiJudgeConfiguration.errors.configurationNotFound");
    const criteria = await this.aiJudgeConfigurationRepository.getCriteriaInLanguage(
      context.configurationId,
      language,
    );
    const criterionIds = criteria.map(({ id }) => id);
    let scoreGuidance: AiJudgeScoreGuidanceLanguageRead[] = [];
    if (criterionIds.length)
      scoreGuidance = await this.aiJudgeConfigurationRepository.getScoreGuidanceInLanguage(
        criterionIds,
        language,
      );
    const blockingErrors = await this.aiJudgeConfigurationRepository.getBlockingErrorsInLanguage(
      context.configurationId,
      language,
    );
    const hasMissingTranslations =
      await this.aiJudgeConfigurationTranslationService.hasMissingTranslations(
        context.configurationId,
        language,
        context.baseLanguage,
      );

    return {
      id: configuration.id,
      aiMentorLessonId: configuration.aiMentorLessonId,
      hasMissingTranslations,
      taskGoal: configuration.taskGoal,
      passingThresholdPercent: configuration.passingThresholdPercent,
      totalMaxScore: criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0),
      criteria: criteria.map((criterion) => ({
        id: criterion.id,
        title: criterion.title,
        expectedBehavior: criterion.expectedBehavior,
        maxScore: criterion.maxScore,
        scoreGuidance: scoreGuidance
          .filter((guidance) => guidance.criterionId === criterion.id)
          .map((guidance) => ({
            id: guidance.id,
            score: guidance.score,
            description: guidance.description,
            example: guidance.example || null,
          })),
      })),
      blockingErrors: blockingErrors.map((blockingError) => ({
        id: blockingError.id,
        description: blockingError.description,
      })),
      language,
      baseLanguage: context.baseLanguage,
      availableLocales: context.availableLocales,
    };
  }

  private resolveLanguage(
    context: ConfiguredAiJudgeLessonContext,
    requestedLanguage?: SupportedLanguages,
  ): SupportedLanguages {
    if (!requestedLanguage) return context.baseLanguage;
    if (!context.availableLocales.includes(requestedLanguage)) return context.baseLanguage;

    return requestedLanguage;
  }
}
