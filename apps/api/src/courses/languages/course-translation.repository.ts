import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { camelCase } from "lodash";

import { DatabasePg, type UUIDType } from "src/common";
import { deleteJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorRoleplayConfigurations,
  aiMentorTeacherConfigurations,
  assessmentQuestionBlankAnswerSets,
  assessmentQuestionBlanks,
  assessmentQuestionChoiceOptions,
  assessmentQuestionDragAndDropOptions,
  assessmentQuestions,
  assessmentQuestionScaleOptions,
  assessmentQuestionTrueFalseStatements,
  assessments,
  chapters,
  courses,
  lessons,
} from "src/storage/schema";

import { COURSE_TRANSLATION_STORAGE_TYPES } from "../course.constants";

import type { QUIZ_TRANSLATION_TARGET_TYPES } from "../course.constants";
import type { CourseTranslationType, QuizTranslationTarget } from "../types/course.types";
import type { SupportedLanguages } from "@repo/shared";

@Injectable()
export class CourseTranslationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async runInTransaction<T>(callback: (trx: DatabasePg) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async getQuizTranslationSnapshot(
    courseId: UUIDType,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
    db: DatabasePg = this.db,
  ) {
    const questions = await db
      .select({
        id: assessmentQuestions.id,
        basePrompt: this.localizationService.getFieldByLanguage(
          assessmentQuestions.prompt,
          baseLanguage,
        ),
        translatedPrompt: this.localizationService.getFieldByLanguage(
          assessmentQuestions.prompt,
          language,
        ),
        questionTitle: this.localizationService.getFieldByLanguage(
          assessmentQuestions.title,
          baseLanguage,
        ),
        questionDescription: this.localizationService.getFieldByLanguage(
          assessmentQuestions.description,
          baseLanguage,
        ),
        lessonTitle: this.localizationService.getFieldByLanguage(lessons.title, baseLanguage),
        chapterTitle: this.localizationService.getFieldByLanguage(chapters.title, baseLanguage),
        courseTitle: this.localizationService.getFieldByLanguage(courses.title, baseLanguage),
      })
      .from(assessmentQuestions)
      .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
      .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(courses.id, courseId));

    const questionIds = questions.map(({ id }) => id);

    if (!questionIds.length) {
      return {
        questions,
        choiceOptions: [],
        trueFalseStatements: [],
        scaleOptions: [],
        dragAndDropOptions: [],
        answerSets: [],
      };
    }

    const [choiceOptions, trueFalseStatements, scaleOptions, dragAndDropOptions, answerSets] =
      await Promise.all([
        db
          .select()
          .from(assessmentQuestionChoiceOptions)
          .where(
            and(
              inArray(assessmentQuestionChoiceOptions.questionId, questionIds),
              inArray(assessmentQuestionChoiceOptions.language, [baseLanguage, language]),
            ),
          ),
        db
          .select()
          .from(assessmentQuestionTrueFalseStatements)
          .where(
            and(
              inArray(assessmentQuestionTrueFalseStatements.questionId, questionIds),
              inArray(assessmentQuestionTrueFalseStatements.language, [baseLanguage, language]),
            ),
          ),
        db
          .select({
            id: assessmentQuestionScaleOptions.id,
            questionId: assessmentQuestionScaleOptions.questionId,
            baseLabel: this.localizationService.getFieldByLanguage(
              assessmentQuestionScaleOptions.label,
              baseLanguage,
            ),
            translatedLabel: this.localizationService.getFieldByLanguage(
              assessmentQuestionScaleOptions.label,
              language,
            ),
          })
          .from(assessmentQuestionScaleOptions)
          .where(inArray(assessmentQuestionScaleOptions.questionId, questionIds)),
        db
          .select()
          .from(assessmentQuestionDragAndDropOptions)
          .where(
            and(
              inArray(assessmentQuestionDragAndDropOptions.questionId, questionIds),
              inArray(assessmentQuestionDragAndDropOptions.language, [baseLanguage, language]),
            ),
          ),
        db
          .select({
            blankId: assessmentQuestionBlankAnswerSets.blankId,
            questionId: assessmentQuestionBlanks.questionId,
            language: assessmentQuestionBlankAnswerSets.language,
            preferredAnswer: assessmentQuestionBlankAnswerSets.preferredAnswer,
          })
          .from(assessmentQuestionBlankAnswerSets)
          .innerJoin(
            assessmentQuestionBlanks,
            eq(assessmentQuestionBlanks.id, assessmentQuestionBlankAnswerSets.blankId),
          )
          .where(
            and(
              inArray(assessmentQuestionBlanks.questionId, questionIds),
              inArray(assessmentQuestionBlankAnswerSets.language, [baseLanguage, language]),
            ),
          ),
      ]);

    return {
      questions,
      choiceOptions,
      trueFalseStatements,
      scaleOptions,
      dragAndDropOptions,
      answerSets,
    };
  }

  async initializeQuizLanguage(
    courseId: UUIDType,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
    db: DatabasePg,
  ) {
    const snapshot = await this.getQuizTranslationSnapshot(courseId, language, baseLanguage, db);
    const baseChoiceOptions = snapshot.choiceOptions.filter(
      (option) => option.language === baseLanguage,
    );
    const baseTrueFalseStatements = snapshot.trueFalseStatements.filter(
      (statement) => statement.language === baseLanguage,
    );
    const baseDragAndDropOptions = snapshot.dragAndDropOptions.filter(
      (option) => option.language === baseLanguage,
    );
    const baseAnswerSets = snapshot.answerSets.filter(
      (answerSet) => answerSet.language === baseLanguage,
    );

    if (baseChoiceOptions.length) {
      await db
        .insert(assessmentQuestionChoiceOptions)
        .values(
          baseChoiceOptions.map(({ questionId, displayOrder, isCorrect }) => ({
            questionId,
            language,
            displayOrder,
            isCorrect,
            label: "",
          })),
        )
        .onConflictDoNothing();
    }

    if (baseTrueFalseStatements.length) {
      await db
        .insert(assessmentQuestionTrueFalseStatements)
        .values(
          baseTrueFalseStatements.map(({ questionId, displayOrder, correctValue }) => ({
            questionId,
            language,
            displayOrder,
            correctValue,
            statement: "",
          })),
        )
        .onConflictDoNothing();
    }

    if (baseDragAndDropOptions.length) {
      await db
        .insert(assessmentQuestionDragAndDropOptions)
        .values(
          baseDragAndDropOptions.map(({ questionId, displayOrder, targetBlankId }) => ({
            questionId,
            language,
            displayOrder,
            targetBlankId,
            label: "",
          })),
        )
        .onConflictDoNothing();
    }

    if (baseAnswerSets.length) {
      await db
        .insert(assessmentQuestionBlankAnswerSets)
        .values(
          baseAnswerSets.map(({ blankId }) => ({
            blankId,
            language,
            preferredAnswer: "",
            acceptedAnswers: [],
          })),
        )
        .onConflictDoNothing();
    }

    const scaleOptionIds = snapshot.scaleOptions.map(({ id }) => id);
    if (scaleOptionIds.length) {
      await db
        .update(assessmentQuestionScaleOptions)
        .set({
          label: setJsonbField(assessmentQuestionScaleOptions.label, language, "", true, true),
        })
        .where(inArray(assessmentQuestionScaleOptions.id, scaleOptionIds));
    }

    const quizLessonIds = await db
      .select({ id: assessments.lessonId })
      .from(assessments)
      .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(chapters.courseId, courseId));

    await this.addAssessmentLocale(
      quizLessonIds.map(({ id }) => id),
      language,
      db,
    );
  }

  updateCourseAvailableLocales(
    courseId: UUIDType,
    availableLocales: SupportedLanguages[],
    db: DatabasePg,
  ) {
    return db.update(courses).set({ availableLocales }).where(eq(courses.id, courseId));
  }

  updateLocalizedField(
    translation: CourseTranslationType,
    language: SupportedLanguages,
    translatedValue: string,
    db: DatabasePg,
  ) {
    const translatedField =
      translation.storageType === COURSE_TRANSLATION_STORAGE_TYPES.TEXT
        ? translatedValue
        : setJsonbField(translation.field, language, translatedValue);

    return db
      .update(translation.field.table)
      .set({ [camelCase(translation.field.name)]: translatedField })
      .where(eq(translation.idColumn, translation.id));
  }

  upsertChoiceOption(
    target: Extract<
      QuizTranslationTarget,
      { type: typeof QUIZ_TRANSLATION_TARGET_TYPES.CHOICE_OPTION }
    >,
    language: SupportedLanguages,
    translatedValue: string,
    db: DatabasePg,
  ) {
    const { questionId, displayOrder, isCorrect } = target;
    return db
      .insert(assessmentQuestionChoiceOptions)
      .values({ questionId, displayOrder, isCorrect, language, label: translatedValue })
      .onConflictDoUpdate({
        target: [
          assessmentQuestionChoiceOptions.tenantId,
          assessmentQuestionChoiceOptions.questionId,
          assessmentQuestionChoiceOptions.language,
          assessmentQuestionChoiceOptions.displayOrder,
        ],
        set: { label: translatedValue, isCorrect },
      });
  }

  upsertTrueFalseStatement(
    target: Extract<
      QuizTranslationTarget,
      { type: typeof QUIZ_TRANSLATION_TARGET_TYPES.TRUE_FALSE_STATEMENT }
    >,
    language: SupportedLanguages,
    translatedValue: string,
    db: DatabasePg,
  ) {
    const { questionId, displayOrder, correctValue } = target;
    return db
      .insert(assessmentQuestionTrueFalseStatements)
      .values({ questionId, displayOrder, correctValue, language, statement: translatedValue })
      .onConflictDoUpdate({
        target: [
          assessmentQuestionTrueFalseStatements.tenantId,
          assessmentQuestionTrueFalseStatements.questionId,
          assessmentQuestionTrueFalseStatements.language,
          assessmentQuestionTrueFalseStatements.displayOrder,
        ],
        set: { statement: translatedValue, correctValue },
      });
  }

  upsertDragAndDropOption(
    target: Extract<
      QuizTranslationTarget,
      { type: typeof QUIZ_TRANSLATION_TARGET_TYPES.DRAG_AND_DROP_OPTION }
    >,
    language: SupportedLanguages,
    translatedValue: string,
    db: DatabasePg,
  ) {
    const { questionId, displayOrder, targetBlankId } = target;
    return db
      .insert(assessmentQuestionDragAndDropOptions)
      .values({ questionId, displayOrder, targetBlankId, language, label: translatedValue })
      .onConflictDoUpdate({
        target: [
          assessmentQuestionDragAndDropOptions.tenantId,
          assessmentQuestionDragAndDropOptions.questionId,
          assessmentQuestionDragAndDropOptions.language,
          assessmentQuestionDragAndDropOptions.displayOrder,
        ],
        set: { label: translatedValue, targetBlankId },
      });
  }

  upsertBlankAnswerSet(
    target: Extract<
      QuizTranslationTarget,
      { type: typeof QUIZ_TRANSLATION_TARGET_TYPES.BLANK_ANSWER_SET }
    >,
    language: SupportedLanguages,
    translatedValue: string,
    db: DatabasePg,
  ) {
    return db
      .insert(assessmentQuestionBlankAnswerSets)
      .values({
        blankId: target.blankId,
        language,
        preferredAnswer: translatedValue,
        acceptedAnswers: [translatedValue],
      })
      .onConflictDoUpdate({
        target: [
          assessmentQuestionBlankAnswerSets.tenantId,
          assessmentQuestionBlankAnswerSets.blankId,
          assessmentQuestionBlankAnswerSets.language,
        ],
        set: { preferredAnswer: translatedValue, acceptedAnswers: [translatedValue] },
      });
  }

  addAssessmentLocale(lessonIds: UUIDType[], language: SupportedLanguages, db: DatabasePg) {
    if (!lessonIds.length) return;

    return db
      .update(assessments)
      .set({
        availableLocales: sql`CASE
          WHEN ${language} = ANY(${assessments.availableLocales})
            THEN ${assessments.availableLocales}
          ELSE ARRAY_APPEND(${assessments.availableLocales}, ${language})
        END`,
      })
      .where(inArray(assessments.lessonId, lessonIds));
  }

  async findCourseChapterIds(courseId: UUIDType, db: DatabasePg) {
    const rows = await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(eq(chapters.courseId, courseId));

    return rows.map(({ id }) => id);
  }

  async findLessonIdsByChapterIds(chapterIds: UUIDType[], db: DatabasePg) {
    if (!chapterIds.length) return [];

    const rows = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(inArray(lessons.chapterId, chapterIds));

    return rows.map(({ id }) => id);
  }

  async findAssessmentQuestionIdsByLessonIds(lessonIds: UUIDType[], db: DatabasePg) {
    if (!lessonIds.length) return [];

    const rows = await db
      .select({ id: assessmentQuestions.id })
      .from(assessmentQuestions)
      .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
      .where(inArray(assessments.lessonId, lessonIds));

    return rows.map(({ id }) => id);
  }

  async findAiJudgeConfigurationIdsByLessonIds(lessonIds: UUIDType[], db: DatabasePg) {
    if (!lessonIds.length) return [];

    const rows = await db
      .select({ id: aiJudgeConfigurations.id })
      .from(aiJudgeConfigurations)
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiJudgeConfigurations.aiMentorLessonId))
      .where(inArray(aiMentorLessons.lessonId, lessonIds));

    return rows.map(({ id }) => id);
  }

  async findAiJudgeCriterionIds(aiJudgeConfigurationIds: UUIDType[], db: DatabasePg) {
    if (!aiJudgeConfigurationIds.length) return [];

    const rows = await db
      .select({ id: aiJudgeCriteria.id })
      .from(aiJudgeCriteria)
      .where(inArray(aiJudgeCriteria.configurationId, aiJudgeConfigurationIds));

    return rows.map(({ id }) => id);
  }

  async removeChapterTitleTranslations(
    chapterIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!chapterIds.length) return;

    await db
      .update(chapters)
      .set({ title: deleteJsonbField(chapters.title, language) })
      .where(inArray(chapters.id, chapterIds));
  }

  async removeLessonTranslations(
    lessonIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!lessonIds.length) return;

    await db
      .update(lessons)
      .set({
        title: deleteJsonbField(lessons.title, language),
        description: deleteJsonbField(lessons.description, language),
      })
      .where(inArray(lessons.id, lessonIds));
  }

  async removeAiMentorLessonNameTranslations(
    lessonIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!lessonIds.length) return;

    await db
      .update(aiMentorLessons)
      .set({ name: deleteJsonbField(aiMentorLessons.name, language) })
      .where(inArray(aiMentorLessons.lessonId, lessonIds));
  }

  async removeAiMentorConfigurationTranslations(
    lessonIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!lessonIds.length) return;

    await db
      .update(aiMentorConfigurations)
      .set({
        openingInstruction: deleteJsonbField(aiMentorConfigurations.openingInstruction, language),
        additionalInstructions: deleteJsonbField(
          aiMentorConfigurations.additionalInstructions,
          language,
        ),
      })
      .where(
        inArray(aiMentorConfigurations.id, this.selectAiMentorConfigurationIds(lessonIds, db)),
      );
  }

  async removeAiMentorTeacherConfigurationTranslations(
    lessonIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!lessonIds.length) return;

    await db
      .update(aiMentorTeacherConfigurations)
      .set({
        taskGoal: deleteJsonbField(aiMentorTeacherConfigurations.taskGoal, language),
        expertise: deleteJsonbField(aiMentorTeacherConfigurations.expertise, language),
        contentScope: deleteJsonbField(aiMentorTeacherConfigurations.contentScope, language),
        feedbackGuidance: deleteJsonbField(
          aiMentorTeacherConfigurations.feedbackGuidance,
          language,
        ),
      })
      .where(
        inArray(
          aiMentorTeacherConfigurations.configurationId,
          this.selectAiMentorConfigurationIds(lessonIds, db),
        ),
      );
  }

  async removeAiMentorRoleplayConfigurationTranslations(
    lessonIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!lessonIds.length) return;

    await db
      .update(aiMentorRoleplayConfigurations)
      .set({
        scenario: deleteJsonbField(aiMentorRoleplayConfigurations.scenario, language),
        aiRole: deleteJsonbField(aiMentorRoleplayConfigurations.aiRole, language),
        learnerRole: deleteJsonbField(aiMentorRoleplayConfigurations.learnerRole, language),
        characterGoal: deleteJsonbField(aiMentorRoleplayConfigurations.characterGoal, language),
        factsAndConstraints: deleteJsonbField(
          aiMentorRoleplayConfigurations.factsAndConstraints,
          language,
        ),
      })
      .where(
        inArray(
          aiMentorRoleplayConfigurations.configurationId,
          this.selectAiMentorConfigurationIds(lessonIds, db),
        ),
      );
  }

  async removeAiJudgeConfigurationTranslations(
    aiJudgeConfigurationIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!aiJudgeConfigurationIds.length) return;

    await db
      .update(aiJudgeConfigurations)
      .set({ taskGoal: deleteJsonbField(aiJudgeConfigurations.taskGoal, language) })
      .where(inArray(aiJudgeConfigurations.id, aiJudgeConfigurationIds));
  }

  async removeAiJudgeCriterionTranslations(
    aiJudgeCriterionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!aiJudgeCriterionIds.length) return;

    await db
      .update(aiJudgeCriteria)
      .set({
        title: deleteJsonbField(aiJudgeCriteria.title, language),
        expectedBehavior: deleteJsonbField(aiJudgeCriteria.expectedBehavior, language),
      })
      .where(inArray(aiJudgeCriteria.id, aiJudgeCriterionIds));
  }

  async removeAiJudgeScoreGuidanceTranslations(
    aiJudgeCriterionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!aiJudgeCriterionIds.length) return;

    await db
      .update(aiJudgeScoreGuidance)
      .set({
        description: deleteJsonbField(aiJudgeScoreGuidance.description, language),
        example: deleteJsonbField(aiJudgeScoreGuidance.example, language),
      })
      .where(inArray(aiJudgeScoreGuidance.criterionId, aiJudgeCriterionIds));
  }

  async removeAiJudgeBlockingErrorTranslations(
    aiJudgeConfigurationIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!aiJudgeConfigurationIds.length) return;

    await db
      .update(aiJudgeBlockingErrors)
      .set({ description: deleteJsonbField(aiJudgeBlockingErrors.description, language) })
      .where(inArray(aiJudgeBlockingErrors.configurationId, aiJudgeConfigurationIds));
  }

  async removeAssessmentQuestionTranslations(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!questionIds.length) return;

    await db
      .update(assessmentQuestions)
      .set({
        title: deleteJsonbField(assessmentQuestions.title, language),
        description: deleteJsonbField(assessmentQuestions.description, language),
      })
      .where(inArray(assessmentQuestions.id, questionIds));
  }

  async deleteChoiceOptionsInLanguage(
    questionIds: UUIDType[],
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    if (!questionIds.length) return;

    await db
      .delete(assessmentQuestionChoiceOptions)
      .where(
        and(
          inArray(assessmentQuestionChoiceOptions.questionId, questionIds),
          eq(assessmentQuestionChoiceOptions.language, language),
        ),
      );
  }

  async removeCourseTranslation(courseId: UUIDType, language: SupportedLanguages, db: DatabasePg) {
    await db
      .update(courses)
      .set({
        title: deleteJsonbField(courses.title, language),
        description: deleteJsonbField(courses.description, language),
        learningOutcomes: deleteJsonbField(courses.learningOutcomes, language),
        availableLocales: sql`ARRAY_REMOVE(${courses.availableLocales}, ${language})`,
      })
      .where(eq(courses.id, courseId));
  }

  private selectAiMentorConfigurationIds(lessonIds: UUIDType[], db: DatabasePg) {
    return db
      .select({ id: aiMentorConfigurations.id })
      .from(aiMentorConfigurations)
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiMentorConfigurations.aiMentorLessonId))
      .where(inArray(aiMentorLessons.lessonId, lessonIds));
  }
}
