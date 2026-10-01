import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { ENTITY_TYPES, type SupportedLanguages } from "@repo/shared";
import { match } from "ts-pattern";

import { AiService } from "src/ai/services/ai.service";
import { DatabasePg, type UUIDType } from "src/common";
import { CourseDurationService } from "src/courses/course-duration.service";
import { CourseDurationRefreshRequestedEvent } from "src/events";
import { SearchIndexService } from "src/global-search/search-index.service";
import { AiJudgeConfigurationTranslationService } from "src/lesson/ai-judge-configuration/ai-judge-configuration-translation.service";
import { AiMentorLessonTranslationService } from "src/lesson/ai-mentor-configuration/services/ai-mentor-lesson-translation.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { BLANK_ANSWER_MARKER_REGEX } from "src/questions/fill-in-the-blanks.utils";
import { DB } from "src/storage/db/db.providers";
import {
  aiMentorLessons,
  assessmentQuestionBlankAnswerSets,
  assessmentQuestionChoiceOptions,
  assessmentQuestionDragAndDropOptions,
  assessmentQuestions,
  assessmentQuestionScaleOptions,
  assessmentQuestionTrueFalseStatements,
  chapters,
  courses,
  lessons,
} from "src/storage/schema";

import { QUIZ_TRANSLATION_TARGET_TYPES } from "../course.constants";
import { CourseService } from "../course.service";
import { MasterCourseService } from "../master-course.service";
import { CourseTranslationRepository } from "../repositories/course-translation.repository";

import type { ContextualCourseTranslationType, CourseTranslationType } from "../types/course.types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseTranslationService {
  private readonly logger = new Logger(CourseTranslationService.name);

  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly courseService: CourseService,
    private readonly courseTranslationRepository: CourseTranslationRepository,
    private readonly localizationService: LocalizationService,
    private readonly aiService: AiService,
    private readonly aiMentorLessonTranslationService: AiMentorLessonTranslationService,
    private readonly aiJudgeConfigurationTranslationService: AiJudgeConfigurationTranslationService,
    private readonly masterCourseService: MasterCourseService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly adminLessonService: AdminLessonService,
    private readonly searchIndexService: SearchIndexService,
    private readonly courseDurationService: CourseDurationService,
  ) {}

  async createLanguage(
    courseId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    await this.masterCourseService.assertCourseContentEditable(courseId);
    await this.adminLessonService.validateAccess(ENTITY_TYPES.COURSE, currentUser, courseId);

    const { baseLanguage, availableLocales } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );
    if (availableLocales.includes(language)) {
      throw new BadRequestException("adminCourseView.createLanguage.alreadyExists");
    }

    await this.db.transaction(async (trx) => {
      await this.courseTranslationRepository.updateCourseAvailableLocales(
        courseId,
        [...availableLocales, language],
        trx,
      );
      await this.courseTranslationRepository.initializeQuizLanguage(
        courseId,
        language,
        baseLanguage,
        trx,
      );
      await this.searchIndexService.refreshCourse(courseId, trx);
    });

    await this.courseDurationService.refreshCourseDurationEstimates(courseId);
  }

  async hasMissingTranslations(
    courseId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    const course = await this.courseService.getBetaCourseById(courseId, language, currentUser);
    if (language === course.baseLanguage) return false;

    const baseCourse = await this.courseService.getBetaCourseById(
      courseId,
      course.baseLanguage,
      currentUser,
    );

    const fieldTranslations = this.collectMissingFieldTranslations(
      courseId,
      course,
      baseCourse,
      true,
    );

    if (fieldTranslations.length) return true;

    const [quizTranslations, mentorTranslations, judgeTranslations] = await Promise.all([
      this.collectMissingQuizTranslations(courseId, language, course.baseLanguage),
      this.aiMentorLessonTranslationService.getMissingTranslations(
        courseId,
        language,
        course.baseLanguage,
      ),
      this.aiJudgeConfigurationTranslationService.getMissingTranslations(
        courseId,
        language,
        course.baseLanguage,
      ),
    ]);

    return Boolean(
      quizTranslations.length || mentorTranslations.length || judgeTranslations.length,
    );
  }

  async generateMissingTranslations(
    courseId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    await this.masterCourseService.assertCourseContentEditable(courseId);

    const { baseLanguage, availableLocales } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    if (!availableLocales.includes(language) || baseLanguage === language) {
      throw new BadRequestException({ message: "adminCourseView.toast.languageNotSupported" });
    }

    const [course, baseCourse] = await Promise.all([
      this.courseService.getBetaCourseById(courseId, language, currentUser),
      this.courseService.getBetaCourseById(courseId, baseLanguage, currentUser),
    ]);

    const fieldTranslations = this.collectMissingFieldTranslationsWithContext(
      courseId,
      course,
      baseCourse,
    );

    const [quizTranslations, mentorTranslations, judgeTranslations] = await Promise.all([
      this.collectMissingQuizTranslations(courseId, language, baseLanguage),
      this.aiMentorLessonTranslationService.getMissingTranslations(
        courseId,
        language,
        baseLanguage,
      ),
      this.aiJudgeConfigurationTranslationService.getMissingTranslations(
        courseId,
        language,
        baseLanguage,
      ),
    ]);

    const contextualTranslations = [
      ...fieldTranslations,
      ...quizTranslations,
      ...mentorTranslations,
      ...judgeTranslations,
    ];

    if (!contextualTranslations.length) {
      throw new BadRequestException({ message: "adminCourseView.toast.noMissingTranslations" });
    }

    this.logger.debug(
      `Generating missing course translations courseId=${courseId} language=${language} count=${contextualTranslations.length}`,
    );

    const generatedChunks = await this.aiService.generateMissingTranslations(
      contextualTranslations,
      language,
      courseId,
    );

    const translatedValues = generatedChunks.flat(1);
    if (contextualTranslations.length !== translatedValues.length) {
      throw new BadRequestException("adminCourseView.toast.mismatchContentLength");
    }

    await this.db.transaction(async (trx) => {
      for (let index = 0; index < translatedValues.length; index++) {
        const translation = contextualTranslations[index].data;
        const translatedValue =
          translation.field === assessmentQuestions.prompt
            ? this.preserveBlankPromptMarkers(translation.base, translatedValues[index])
            : translatedValues[index];

        if (translation.quizTarget) {
          await this.persistQuizTranslation(translation, translatedValue, language, trx);
          continue;
        }

        await this.courseTranslationRepository.updateLocalizedField(
          translation,
          language,
          translatedValue,
          trx,
        );
      }

      const quizLessonIds = baseCourse.chapters.flatMap((chapter) =>
        (chapter.lessons ?? [])
          .filter((lesson) => lesson.type === LESSON_TYPES.QUIZ)
          .map(({ id }) => id),
      );
      await this.courseTranslationRepository.addAssessmentLocale(quizLessonIds, language, trx);
    });

    await this.outboxPublisher.publish(new CourseDurationRefreshRequestedEvent({ courseId }));
    this.logger.debug(
      `Imported missing course translations courseId=${courseId} language=${language} count=${translatedValues.length}`,
    );
  }

  private async collectMissingQuizTranslations(
    courseId: UUIDType,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ): Promise<ContextualCourseTranslationType[]> {
    const snapshot = await this.courseTranslationRepository.getQuizTranslationSnapshot(
      courseId,
      language,
      baseLanguage,
    );

    const questionById = new Map(snapshot.questions.map((question) => [question.id, question]));
    const translations: ContextualCourseTranslationType[] = [];

    const addTranslation = (data: CourseTranslationType, questionId: UUIDType) => {
      const question = questionById.get(questionId);
      translations.push({
        data,
        metadata: data.field.name,
        context: {
          courseTitle: question?.courseTitle || undefined,
          chapterTitle: question?.chapterTitle || undefined,
          lessonTitle: question?.lessonTitle || undefined,
          questionTitle: question?.questionTitle || undefined,
          questionDescription: question?.questionDescription || undefined,
        },
      });
    };

    for (const question of snapshot.questions) {
      if (question.translatedPrompt?.length || !question.basePrompt?.length) continue;
      addTranslation(
        {
          id: question.id,
          base: question.basePrompt,
          field: assessmentQuestions.prompt,
          idColumn: assessmentQuestions.id,
        },
        question.id,
      );
    }

    const translatedChoiceKeys = new Set(
      snapshot.choiceOptions
        .filter((option) => option.language === language && option.label.length)
        .map((option) => `${option.questionId}:${option.displayOrder}`),
    );

    for (const option of snapshot.choiceOptions.filter(
      (option) => option.language === baseLanguage,
    )) {
      if (translatedChoiceKeys.has(`${option.questionId}:${option.displayOrder}`)) continue;
      addTranslation(
        {
          id: option.id,
          base: option.label,
          field: assessmentQuestionChoiceOptions.label,
          idColumn: assessmentQuestionChoiceOptions.id,
          quizTarget: {
            type: QUIZ_TRANSLATION_TARGET_TYPES.CHOICE_OPTION,
            questionId: option.questionId,
            displayOrder: option.displayOrder,
            isCorrect: option.isCorrect,
          },
        },
        option.questionId,
      );
    }

    const translatedStatementKeys = new Set(
      snapshot.trueFalseStatements
        .filter((statement) => statement.language === language && statement.statement.length)
        .map((statement) => `${statement.questionId}:${statement.displayOrder}`),
    );

    for (const statement of snapshot.trueFalseStatements.filter(
      (statement) => statement.language === baseLanguage,
    )) {
      if (translatedStatementKeys.has(`${statement.questionId}:${statement.displayOrder}`))
        continue;
      addTranslation(
        {
          id: statement.id,
          base: statement.statement,
          field: assessmentQuestionTrueFalseStatements.statement,
          idColumn: assessmentQuestionTrueFalseStatements.id,
          quizTarget: {
            type: QUIZ_TRANSLATION_TARGET_TYPES.TRUE_FALSE_STATEMENT,
            questionId: statement.questionId,
            displayOrder: statement.displayOrder,
            correctValue: statement.correctValue,
          },
        },
        statement.questionId,
      );
    }

    for (const option of snapshot.scaleOptions) {
      if (option.translatedLabel?.length || !option.baseLabel?.length) continue;
      addTranslation(
        {
          id: option.id,
          base: option.baseLabel,
          field: assessmentQuestionScaleOptions.label,
          idColumn: assessmentQuestionScaleOptions.id,
        },
        option.questionId,
      );
    }

    const translatedDragOptionKeys = new Set(
      snapshot.dragAndDropOptions
        .filter((option) => option.language === language && option.label.length)
        .map((option) => `${option.questionId}:${option.displayOrder}`),
    );

    for (const option of snapshot.dragAndDropOptions.filter(
      (option) => option.language === baseLanguage,
    )) {
      if (translatedDragOptionKeys.has(`${option.questionId}:${option.displayOrder}`)) continue;
      addTranslation(
        {
          id: option.id,
          base: option.label,
          field: assessmentQuestionDragAndDropOptions.label,
          idColumn: assessmentQuestionDragAndDropOptions.id,
          quizTarget: {
            type: QUIZ_TRANSLATION_TARGET_TYPES.DRAG_AND_DROP_OPTION,
            questionId: option.questionId,
            displayOrder: option.displayOrder,
            targetBlankId: option.targetBlankId,
          },
        },
        option.questionId,
      );
    }

    const translatedAnswerSetIds = new Set(
      snapshot.answerSets
        .filter((answerSet) => answerSet.language === language && answerSet.preferredAnswer.length)
        .map(({ blankId }) => blankId),
    );

    for (const answerSet of snapshot.answerSets.filter(
      (answerSet) => answerSet.language === baseLanguage,
    )) {
      if (translatedAnswerSetIds.has(answerSet.blankId)) continue;
      addTranslation(
        {
          id: answerSet.blankId,
          base: answerSet.preferredAnswer,
          field: assessmentQuestionBlankAnswerSets.preferredAnswer,
          idColumn: assessmentQuestionBlankAnswerSets.blankId,
          quizTarget: {
            type: QUIZ_TRANSLATION_TARGET_TYPES.BLANK_ANSWER_SET,
            blankId: answerSet.blankId,
          },
        },
        answerSet.questionId,
      );
    }

    return translations;
  }

  private *translationCandidates(
    courseId: UUIDType,
    course: Awaited<ReturnType<CourseService["getBetaCourseById"]>>,
    baseCourse?: Awaited<ReturnType<CourseService["getBetaCourseById"]>>,
  ): Generator<{
    id: string | undefined;
    hasValue: boolean;
    baseValue: string | null | undefined;
    field: AnyPgColumn;
    idColumn: AnyPgColumn;
    storageType?: CourseTranslationType["storageType"];
  }> {
    yield {
      id: courseId,
      hasValue: Boolean(course.title?.length),
      baseValue: baseCourse?.title,
      field: courses.title,
      idColumn: courses.id,
    };
    yield {
      id: courseId,
      hasValue: Boolean(course.description?.length),
      baseValue: baseCourse?.description,
      field: courses.description,
      idColumn: courses.id,
    };

    const baseChapterMap = new Map(
      (baseCourse?.chapters ?? []).map((chapter) => [chapter.id, chapter]),
    );

    for (const chapter of course.chapters) {
      const baseChapter = baseChapterMap.get(chapter.id);
      yield {
        id: chapter.id,
        hasValue: Boolean(chapter.title?.length),
        baseValue: baseChapter?.title,
        field: chapters.title,
        idColumn: chapters.id,
      };

      const baseLessonMap = new Map(
        (baseChapter?.lessons ?? []).map((lesson) => [lesson.id, lesson]),
      );
      for (const lesson of chapter.lessons ?? []) {
        const baseLesson = baseLessonMap.get(lesson.id);
        yield {
          id: lesson.id,
          hasValue: Boolean(lesson.title?.length),
          baseValue: baseLesson?.title,
          field: lessons.title,
          idColumn: lessons.id,
        };
        yield {
          id: lesson.id,
          hasValue: Boolean(lesson.description?.length),
          baseValue: baseLesson?.description,
          field: lessons.description,
          idColumn: lessons.id,
        };
        if (lesson.type === LESSON_TYPES.AI_MENTOR) {
          yield {
            id: lesson.id,
            hasValue: Boolean(lesson.aiMentor?.name?.length),
            baseValue: baseLesson?.aiMentor?.name,
            field: aiMentorLessons.name,
            idColumn: aiMentorLessons.lessonId,
          };
        }
        if (lesson.type !== LESSON_TYPES.QUIZ || !lesson.questions?.length) continue;

        const baseQuestionMap = new Map(
          (baseLesson?.questions ?? []).map((question) => [question.id, question]),
        );
        for (const question of lesson.questions) {
          const baseQuestion = baseQuestionMap.get(question.id);
          yield {
            id: question.id,
            hasValue: Boolean(question.title?.length),
            baseValue: baseQuestion?.title,
            field: assessmentQuestions.title,
            idColumn: assessmentQuestions.id,
          };
          yield {
            id: question.id,
            hasValue: Boolean(question.description?.length),
            baseValue: baseQuestion?.description,
            field: assessmentQuestions.description,
            idColumn: assessmentQuestions.id,
          };
        }
      }
    }
  }

  private collectMissingFieldTranslations(
    courseId: UUIDType,
    course: Awaited<ReturnType<CourseService["getBetaCourseById"]>>,
    baseCourse?: Awaited<ReturnType<CourseService["getBetaCourseById"]>>,
    earlyReturn = false,
  ) {
    const translations: CourseTranslationType[] = [];
    for (const candidate of this.translationCandidates(courseId, course, baseCourse)) {
      if (candidate.hasValue || !candidate.id || !candidate.baseValue?.length) continue;
      translations.push({
        id: candidate.id,
        base: candidate.baseValue,
        field: candidate.field,
        idColumn: candidate.idColumn,
        storageType: candidate.storageType,
      });
      if (earlyReturn) break;
    }
    return translations;
  }

  private collectMissingFieldTranslationsWithContext(
    courseId: UUIDType,
    course: Awaited<ReturnType<CourseService["getBetaCourseById"]>>,
    baseCourse: Awaited<ReturnType<CourseService["getBetaCourseById"]>>,
  ): ContextualCourseTranslationType[] {
    const translations = this.collectMissingFieldTranslations(courseId, course, baseCourse);
    const chapterById = new Map(baseCourse.chapters.map((chapter) => [chapter.id, chapter]));
    const lessonById = new Map(
      baseCourse.chapters.flatMap((chapter) =>
        (chapter.lessons ?? []).map((lesson) => [lesson.id, { chapter, lesson }] as const),
      ),
    );
    const questionById = new Map(
      baseCourse.chapters.flatMap((chapter) =>
        (chapter.lessons ?? []).flatMap((lesson) =>
          (lesson.questions ?? []).map(
            (question) => [question.id, { chapter, lesson, question }] as const,
          ),
        ),
      ),
    );

    return translations.map((data) => {
      const chapter = chapterById.get(data.id as UUIDType);
      const lessonContext = lessonById.get(data.id as UUIDType);
      const questionContext = questionById.get(data.id as UUIDType);
      return {
        data,
        metadata: data.field.name,
        context: {
          courseTitle: baseCourse.title,
          chapterTitle:
            chapter?.title ?? lessonContext?.chapter.title ?? questionContext?.chapter.title,
          lessonTitle: lessonContext?.lesson.title ?? questionContext?.lesson.title,
          lessonDescription:
            lessonContext?.lesson.description ?? questionContext?.lesson.description ?? undefined,
          questionTitle: questionContext?.question.title,
          questionDescription: questionContext?.question.description ?? undefined,
          questionOptions: questionContext?.question.options
            ?.map((option) => option.optionText || option.matchedWord)
            .filter(Boolean)
            .join("\n"),
        },
      };
    });
  }

  private preserveBlankPromptMarkers(sourcePrompt: string, translatedPrompt: string) {
    const sourceMarkerIds = Array.from(
      sourcePrompt.matchAll(BLANK_ANSWER_MARKER_REGEX),
      (match) => match[1],
    );
    if (!sourceMarkerIds.length) return translatedPrompt;

    const translatedMarkers = Array.from(translatedPrompt.matchAll(BLANK_ANSWER_MARKER_REGEX));
    if (translatedMarkers.length !== sourceMarkerIds.length) {
      throw new BadRequestException("adminCourseView.toast.mismatchContentLength");
    }

    let markerIndex = 0;
    return translatedPrompt.replace(
      BLANK_ANSWER_MARKER_REGEX,
      () => `<blank-answer-${sourceMarkerIds[markerIndex++]}>`,
    );
  }

  private persistQuizTranslation(
    translation: CourseTranslationType,
    translatedValue: string,
    language: SupportedLanguages,
    db: DatabasePg,
  ) {
    const target = translation.quizTarget;

    if (!target) return;

    return match(target)
      .with({ type: QUIZ_TRANSLATION_TARGET_TYPES.CHOICE_OPTION }, (option) =>
        this.courseTranslationRepository.upsertChoiceOption(option, language, translatedValue, db),
      )
      .with({ type: QUIZ_TRANSLATION_TARGET_TYPES.TRUE_FALSE_STATEMENT }, (statement) =>
        this.courseTranslationRepository.upsertTrueFalseStatement(
          statement,
          language,
          translatedValue,
          db,
        ),
      )
      .with({ type: QUIZ_TRANSLATION_TARGET_TYPES.DRAG_AND_DROP_OPTION }, (option) =>
        this.courseTranslationRepository.upsertDragAndDropOption(
          option,
          language,
          translatedValue,
          db,
        ),
      )
      .with({ type: QUIZ_TRANSLATION_TARGET_TYPES.BLANK_ANSWER_SET }, (answerSet) =>
        this.courseTranslationRepository.upsertBlankAnswerSet(
          answerSet,
          language,
          translatedValue,
          db,
        ),
      )
      .exhaustive();
  }
}
