import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { camelCase } from "lodash";

import { DatabasePg, type UUIDType } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
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
}
