import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AI_MENTOR_TYPE, COURSE_FEATURE, ENTITY_TYPES, LESSON_TYPES } from "@repo/shared";

import { CourseFeaturePolicyService } from "src/courses/course-feature-policy.service";
import { MasterCourseService } from "src/courses/master-course.service";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { getExactLocalizedText } from "src/localization/localization.utils";

import { AiMentorConfigurationRepository } from "../repositories/ai-mentor-configuration.repository";
import {
  hasMissingAiMentorConfigurationTranslations,
  needsAiMentorConfiguration,
} from "../utils/ai-mentor-configuration.helpers";

import { AiMentorConfigurationGraphService } from "./ai-mentor-configuration-graph.service";

import type {
  AiMentorConfigurationContent,
  AiMentorConfigurationResponse,
  UpdateAiMentorConfigurationTranslationBody,
} from "../schemas/ai-mentor-configuration.schema";
import type {
  AiMentorConfigurationGraph,
  AiMentorGenerationAuthoringContext,
  AiMentorLessonContext,
  ConfiguredAiMentorLessonContext,
} from "../types/ai-mentor-configuration.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AiMentorConfigurationService {
  constructor(
    private readonly aiMentorConfigurationRepository: AiMentorConfigurationRepository,
    private readonly aiMentorConfigurationGraphService: AiMentorConfigurationGraphService,
    private readonly adminLessonService: AdminLessonService,
    private readonly masterCourseService: MasterCourseService,
    private readonly courseFeaturePolicyService: CourseFeaturePolicyService,
  ) {}

  async getConfiguration(
    lessonId: UUIDType,
    currentUser: CurrentUserType,
    requestedLanguage?: SupportedLanguages,
  ): Promise<AiMentorConfigurationResponse> {
    await this.adminLessonService.validateAccess(ENTITY_TYPES.LESSON, currentUser, lessonId);
    const context = await this.getConfiguredContext(lessonId);

    return this.buildResponse(context, requestedLanguage);
  }

  async replaceConfiguration(
    lessonId: UUIDType,
    data: AiMentorConfigurationContent,
    currentUser: CurrentUserType,
  ): Promise<AiMentorConfigurationResponse> {
    const context = await this.prepareStructuralWrite(lessonId, currentUser);

    await this.aiMentorConfigurationGraphService.replaceConfiguration(
      context.configurationId,
      data,
      context.baseLanguage,
    );

    return this.buildResponse({ ...context, configurationType: data.type }, context.baseLanguage);
  }

  async prepareGenerationAuthoringContext(
    courseId: UUIDType,
    lessonId: UUIDType | undefined,
    currentUser: CurrentUserType,
  ): Promise<AiMentorGenerationAuthoringContext> {
    if (lessonId) {
      const context = await this.prepareLessonStructuralWrite(lessonId, currentUser);
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

    const context =
      await this.aiMentorConfigurationRepository.findCourseAuthoringContext(courseId);
    if (!context) throw new NotFoundException("adminCourseView.errors.notFound.course");

    return context;
  }

  async updateTranslations(
    lessonId: UUIDType,
    language: SupportedLanguages,
    data: UpdateAiMentorConfigurationTranslationBody,
    currentUser: CurrentUserType,
  ): Promise<AiMentorConfigurationResponse> {
    const context = await this.prepareStructuralWrite(lessonId, currentUser);

    if (!context.availableLocales.includes(language))
      throw new BadRequestException("adminCourseView.toast.languageNotSupported");
    if (language === context.baseLanguage)
      throw new BadRequestException(
        "aiMentorConfiguration.errors.translationRequiresNonBaseLanguage",
      );

    await this.aiMentorConfigurationGraphService.updateTranslations(
      context.configurationId,
      language,
      data,
    );

    return this.buildResponse(context, language);
  }

  private async prepareStructuralWrite(
    lessonId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<ConfiguredAiMentorLessonContext> {
    await this.prepareLessonStructuralWrite(lessonId, currentUser);

    return this.getConfiguredContext(lessonId);
  }

  private async prepareLessonStructuralWrite(
    lessonId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<AiMentorLessonContext> {
    await this.masterCourseService.assertCourseContentEditableByLessonId(lessonId);
    await this.courseFeaturePolicyService.assertCourseFeatureEnabledByLessonId(
      lessonId,
      COURSE_FEATURE.CURRICULUM_EDITING,
    );
    await this.adminLessonService.validateAccess(ENTITY_TYPES.LESSON, currentUser, lessonId);

    return this.getLessonContext(lessonId);
  }

  private async getConfiguredContext(lessonId: UUIDType): Promise<ConfiguredAiMentorLessonContext> {
    const context = await this.getLessonContext(lessonId);
    if (!context.configurationId || !context.configurationType)
      throw new NotFoundException("aiMentorConfiguration.errors.configurationNotFound");

    return {
      ...context,
      aiMentorLessonId: context.aiMentorLessonId,
      configurationId: context.configurationId,
      configurationType: context.configurationType,
    };
  }

  private async getLessonContext(
    lessonId: UUIDType,
  ): Promise<AiMentorLessonContext> {
    const context = await this.aiMentorConfigurationRepository.findLessonContext(lessonId);

    if (!context) throw new NotFoundException("adminCourseView.errors.notFound.lesson");
    if (context.lessonType !== LESSON_TYPES.AI_MENTOR || !context.aiMentorLessonId)
      throw new BadRequestException("aiMentorConfiguration.errors.invalidLessonType");

    return { ...context, aiMentorLessonId: context.aiMentorLessonId };
  }

  private async buildResponse(
    context: ConfiguredAiMentorLessonContext,
    requestedLanguage?: SupportedLanguages,
  ): Promise<AiMentorConfigurationResponse> {
    const language = this.resolveLanguage(context, requestedLanguage);
    const graph = await this.aiMentorConfigurationGraphService.getValidatedGraph(
      context.configurationId,
    );
    const metadata = this.buildResponseMetadata(context, graph, language);

    if (graph.configuration.type === AI_MENTOR_TYPE.TEACHER) {
      const teacher = graph.teacherConfiguration;
      if (!teacher) throw new BadRequestException("aiMentorConfiguration.errors.invalidGraph");

      return {
        ...metadata,
        type: AI_MENTOR_TYPE.TEACHER,
        taskGoal: getExactLocalizedText(teacher.taskGoal, language) ?? "",
        expertise: getExactLocalizedText(teacher.expertise, language) ?? "",
        contentScope: getExactLocalizedText(teacher.contentScope, language) ?? "",
        teachingStyle: teacher.teachingStyle,
        feedbackGuidance: getExactLocalizedText(teacher.feedbackGuidance, language) ?? null,
      };
    }

    const roleplay = graph.roleplayConfiguration;
    if (!roleplay) throw new BadRequestException("aiMentorConfiguration.errors.invalidGraph");

    return {
      ...metadata,
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: getExactLocalizedText(roleplay.scenario, language) ?? "",
      aiRole: getExactLocalizedText(roleplay.aiRole, language) ?? "",
      learnerRole: getExactLocalizedText(roleplay.learnerRole, language) ?? "",
      characterGoal: getExactLocalizedText(roleplay.characterGoal, language) ?? "",
      difficulty: roleplay.difficulty,
      factsAndConstraints: getExactLocalizedText(roleplay.factsAndConstraints, language) ?? null,
    };
  }

  private buildResponseMetadata(
    context: ConfiguredAiMentorLessonContext,
    graph: AiMentorConfigurationGraph,
    language: SupportedLanguages,
  ) {
    return {
      id: graph.configuration.id,
      aiMentorLessonId: graph.configuration.aiMentorLessonId,
      needsConfiguration: needsAiMentorConfiguration(graph, context.baseLanguage),
      hasMissingTranslations: hasMissingAiMentorConfigurationTranslations(
        graph,
        language,
        context.baseLanguage,
      ),
      openingInstruction:
        getExactLocalizedText(graph.configuration.openingInstruction, language) ?? null,
      additionalInstructions:
        getExactLocalizedText(graph.configuration.additionalInstructions, language) ?? null,
      language,
      baseLanguage: context.baseLanguage,
      availableLocales: context.availableLocales,
    };
  }

  private resolveLanguage(
    context: ConfiguredAiMentorLessonContext,
    requestedLanguage?: SupportedLanguages,
  ) {
    if (!requestedLanguage || !context.availableLocales.includes(requestedLanguage))
      return context.baseLanguage;

    return requestedLanguage;
  }
}
