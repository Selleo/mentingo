import { Injectable } from "@nestjs/common";
import { AI_MENTOR_TYPE } from "@repo/shared";

import { getExactLocalizedText } from "src/localization/localization.utils";
import {
  aiMentorConfigurations,
  aiMentorRoleplayConfigurations,
  aiMentorTeacherConfigurations,
} from "src/storage/schema";

import { AiMentorConfigurationRepository } from "../repositories/ai-mentor-configuration.repository";

import type {
  AiMentorConfigurationCourseTranslationSource,
  AiMentorTranslationCandidate,
} from "../types/ai-mentor-lesson-translation.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type {
  ContextualCourseTranslationType,
  CourseTranslationContext,
} from "src/courses/types/course.types";

@Injectable()
export class AiMentorLessonTranslationService {
  constructor(private readonly aiMentorConfigurationRepository: AiMentorConfigurationRepository) {}

  async getMissingTranslations(
    courseId: UUIDType,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ): Promise<ContextualCourseTranslationType[]> {
    const configurations =
      await this.aiMentorConfigurationRepository.getConfigurationsForCourse(courseId);

    return configurations.flatMap((configuration) => {
      const context: CourseTranslationContext = {
        courseTitle: getExactLocalizedText(configuration.courseTitle, baseLanguage),
        lessonTitle: getExactLocalizedText(configuration.lessonTitle, baseLanguage),
        lessonDescription: getExactLocalizedText(configuration.lessonDescription, baseLanguage),
      };
      const commonCandidates: AiMentorTranslationCandidate[] = [
        {
          id: configuration.configurationId,
          source: configuration.openingInstruction,
          field: aiMentorConfigurations.openingInstruction,
          idColumn: aiMentorConfigurations.id,
          metadata: "AI Mentor opening instruction",
        },
        {
          id: configuration.configurationId,
          source: configuration.additionalInstructions,
          field: aiMentorConfigurations.additionalInstructions,
          idColumn: aiMentorConfigurations.id,
          metadata: "AI Mentor additional instructions",
        },
      ];
      const subtypeCandidates =
        configuration.type === AI_MENTOR_TYPE.TEACHER
          ? this.getTeacherCandidates(configuration)
          : this.getRoleplayCandidates(configuration);

      return [...commonCandidates, ...subtypeCandidates].flatMap((candidate) =>
        this.toMissingTranslation(candidate, context, language, baseLanguage),
      );
    });
  }

  private getTeacherCandidates(
    configuration: AiMentorConfigurationCourseTranslationSource,
  ): AiMentorTranslationCandidate[] {
    if (!configuration.teacherConfigurationId) return [];

    return [
      {
        id: configuration.teacherConfigurationId,
        source: configuration.taskGoal,
        field: aiMentorTeacherConfigurations.taskGoal,
        idColumn: aiMentorTeacherConfigurations.id,
        metadata: "AI Mentor teaching task goal",
      },
      {
        id: configuration.teacherConfigurationId,
        source: configuration.expertise,
        field: aiMentorTeacherConfigurations.expertise,
        idColumn: aiMentorTeacherConfigurations.id,
        metadata: "AI Mentor expertise",
      },
      {
        id: configuration.teacherConfigurationId,
        source: configuration.contentScope,
        field: aiMentorTeacherConfigurations.contentScope,
        idColumn: aiMentorTeacherConfigurations.id,
        metadata: "AI Mentor content scope",
      },
      {
        id: configuration.teacherConfigurationId,
        source: configuration.feedbackGuidance,
        field: aiMentorTeacherConfigurations.feedbackGuidance,
        idColumn: aiMentorTeacherConfigurations.id,
        metadata: "AI Mentor feedback guidance",
      },
    ];
  }

  private getRoleplayCandidates(
    configuration: AiMentorConfigurationCourseTranslationSource,
  ): AiMentorTranslationCandidate[] {
    if (!configuration.roleplayConfigurationId) return [];

    return [
      {
        id: configuration.roleplayConfigurationId,
        source: configuration.scenario,
        field: aiMentorRoleplayConfigurations.scenario,
        idColumn: aiMentorRoleplayConfigurations.id,
        metadata: "AI Mentor scenario",
      },
      {
        id: configuration.roleplayConfigurationId,
        source: configuration.aiRole,
        field: aiMentorRoleplayConfigurations.aiRole,
        idColumn: aiMentorRoleplayConfigurations.id,
        metadata: "AI Mentor AI role",
      },
      {
        id: configuration.roleplayConfigurationId,
        source: configuration.learnerRole,
        field: aiMentorRoleplayConfigurations.learnerRole,
        idColumn: aiMentorRoleplayConfigurations.id,
        metadata: "AI Mentor learner role",
      },
      {
        id: configuration.roleplayConfigurationId,
        source: configuration.characterGoal,
        field: aiMentorRoleplayConfigurations.characterGoal,
        idColumn: aiMentorRoleplayConfigurations.id,
        metadata: "AI Mentor character goal",
      },
      {
        id: configuration.roleplayConfigurationId,
        source: configuration.factsAndConstraints,
        field: aiMentorRoleplayConfigurations.factsAndConstraints,
        idColumn: aiMentorRoleplayConfigurations.id,
        metadata: "AI Mentor facts and constraints",
      },
    ];
  }

  private toMissingTranslation(
    candidate: AiMentorTranslationCandidate,
    context: CourseTranslationContext,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ): ContextualCourseTranslationType[] {
    const base = getExactLocalizedText(candidate.source, baseLanguage);
    const translated = getExactLocalizedText(candidate.source, language);

    if (!base?.length || translated?.length) return [];

    return [
      {
        data: {
          id: candidate.id,
          base,
          field: candidate.field,
          idColumn: candidate.idColumn,
        },
        metadata: candidate.metadata,
        context,
      },
    ];
  }
}
