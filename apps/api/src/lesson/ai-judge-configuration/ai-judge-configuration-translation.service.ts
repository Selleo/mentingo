import { Injectable } from "@nestjs/common";

import {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
} from "src/storage/schema";

import { AiJudgeConfigurationRepository } from "./ai-judge-configuration.repository";

import type { AiJudgeTranslationCandidateInput } from "./ai-judge-configuration.types";
import type { LocalizedText, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type {
  ContextualCourseTranslationType,
  CourseTranslationContext,
} from "src/courses/types/course.types";

@Injectable()
export class AiJudgeConfigurationTranslationService {
  constructor(private readonly aiJudgeConfigurationRepository: AiJudgeConfigurationRepository) {}

  async hasMissingTranslations(
    configurationId: UUIDType,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ): Promise<boolean> {
    if (language === baseLanguage) return false;

    const graph = await this.aiJudgeConfigurationRepository.getConfigurationGraph(configurationId);
    if (!graph) return false;

    const localizedValues = [
      graph.configuration.taskGoal,
      ...graph.criteria.flatMap((criterion) => [criterion.title, criterion.expectedBehavior]),
      ...graph.scoreGuidance.flatMap((guidance) => [guidance.description, guidance.example]),
      ...graph.blockingErrors.map((blockingError) => blockingError.description),
    ];

    return localizedValues.some((value) => {
      const base = this.getLanguageValue(value, baseLanguage);
      const translated = this.getLanguageValue(value, language);

      return Boolean(base?.length && !translated?.length);
    });
  }

  async getMissingTranslations(
    courseId: UUIDType,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ): Promise<ContextualCourseTranslationType[]> {
    const [configurations, criteria, scoreGuidance, blockingErrors] = await Promise.all([
      this.aiJudgeConfigurationRepository.getConfigurationsForCourse(courseId),
      this.aiJudgeConfigurationRepository.getCriteriaForCourse(courseId),
      this.aiJudgeConfigurationRepository.getScoreGuidanceForCourse(courseId),
      this.aiJudgeConfigurationRepository.getBlockingErrorsForCourse(courseId),
    ]);

    return [
      ...configurations.flatMap((configuration) =>
        this.toMissingTranslation(
          {
            id: configuration.id,
            source: configuration.taskGoal,
            field: aiJudgeConfigurations.taskGoal,
            idColumn: aiJudgeConfigurations.id,
            metadata: "AI Judge task goal",
            context: this.getContext(configuration, baseLanguage),
          },
          language,
          baseLanguage,
        ),
      ),
      ...criteria.flatMap((criterion) => {
        const context = {
          ...this.getContext(criterion, baseLanguage),
          aiJudgeTaskGoal: this.getLanguageValue(criterion.taskGoal, baseLanguage),
          aiJudgeCriterionTitle: this.getLanguageValue(criterion.title, baseLanguage),
          aiJudgeExpectedBehavior: this.getLanguageValue(criterion.expectedBehavior, baseLanguage),
        };

        return [
          ...this.toMissingTranslation(
            {
              id: criterion.id,
              source: criterion.title,
              field: aiJudgeCriteria.title,
              idColumn: aiJudgeCriteria.id,
              metadata: "AI Judge criterion title",
              context,
            },
            language,
            baseLanguage,
          ),
          ...this.toMissingTranslation(
            {
              id: criterion.id,
              source: criterion.expectedBehavior,
              field: aiJudgeCriteria.expectedBehavior,
              idColumn: aiJudgeCriteria.id,
              metadata: "AI Judge criterion expected behavior",
              context,
            },
            language,
            baseLanguage,
          ),
        ];
      }),
      ...scoreGuidance.flatMap((guidance) => {
        const context = {
          ...this.getContext(guidance, baseLanguage),
          aiJudgeTaskGoal: this.getLanguageValue(guidance.taskGoal, baseLanguage),
          aiJudgeCriterionTitle: this.getLanguageValue(guidance.criterionTitle, baseLanguage),
          aiJudgeExpectedBehavior: this.getLanguageValue(
            guidance.criterionExpectedBehavior,
            baseLanguage,
          ),
          aiJudgeScore: `${guidance.score}/${guidance.criterionMaxScore}`,
        };

        return [
          ...this.toMissingTranslation(
            {
              id: guidance.id,
              source: guidance.description,
              field: aiJudgeScoreGuidance.description,
              idColumn: aiJudgeScoreGuidance.id,
              metadata: `AI Judge score ${guidance.score} guidance`,
              context,
            },
            language,
            baseLanguage,
          ),
          ...this.toMissingTranslation(
            {
              id: guidance.id,
              source: guidance.example,
              field: aiJudgeScoreGuidance.example,
              idColumn: aiJudgeScoreGuidance.id,
              metadata: `AI Judge score ${guidance.score} example`,
              context,
            },
            language,
            baseLanguage,
          ),
        ];
      }),
      ...blockingErrors.flatMap((blockingError) =>
        this.toMissingTranslation(
          {
            id: blockingError.id,
            source: blockingError.description,
            field: aiJudgeBlockingErrors.description,
            idColumn: aiJudgeBlockingErrors.id,
            metadata: "AI Judge blocking error",
            context: {
              ...this.getContext(blockingError, baseLanguage),
              aiJudgeTaskGoal: this.getLanguageValue(blockingError.taskGoal, baseLanguage),
            },
          },
          language,
          baseLanguage,
        ),
      ),
    ];
  }

  private toMissingTranslation(
    input: AiJudgeTranslationCandidateInput,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ): ContextualCourseTranslationType[] {
    const base = this.getLanguageValue(input.source, baseLanguage);
    const translated = this.getLanguageValue(input.source, language);

    if (!base?.length || translated?.length) return [];

    return [
      {
        data: {
          id: input.id,
          base,
          field: input.field,
          idColumn: input.idColumn,
        },
        metadata: input.metadata,
        context: input.context,
      },
    ];
  }

  private getContext(
    value: {
      courseTitle: LocalizedText;
      lessonTitle: LocalizedText;
      lessonDescription: LocalizedText | null;
    },
    baseLanguage: SupportedLanguages,
  ): CourseTranslationContext {
    return {
      courseTitle: this.getLanguageValue(value.courseTitle, baseLanguage),
      lessonTitle: this.getLanguageValue(value.lessonTitle, baseLanguage),
      lessonDescription: this.getLanguageValue(value.lessonDescription, baseLanguage),
    };
  }

  private getLanguageValue(value: LocalizedText | null, language: SupportedLanguages) {
    return value?.[language];
  }
}
