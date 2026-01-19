import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { ALLOWED_AVATAR_IMAGE_TYPES, ALLOWED_VIDEO_FILE_TYPES } from "@repo/shared";
import { getTableColumns, sql } from "drizzle-orm";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { CreateLessonEvent, DeleteLessonEvent, UpdateLessonEvent } from "src/events";
import {
  ENTITY_TYPES,
  RESOURCE_CATEGORIES,
  RESOURCE_RELATIONSHIP_TYPES,
} from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { FileGuard } from "src/file/guards/file.guard";
import { DocumentService } from "src/ingestion/services/document.service";
import { MAX_LESSON_TITLE_LENGTH } from "src/lesson/repositories/lesson.constants";
import { LessonService } from "src/lesson/services/lesson.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { questionAnswerOptions, questions } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { isRichTextEmpty } from "src/utils/isRichTextEmpty";

import { LESSON_TYPES } from "../lesson.type";
import { AdminLessonRepository } from "../repositories/adminLesson.repository";
import { LessonRepository } from "../repositories/lesson.repository";

import type { LessonResourceMetadata } from "../lesson-resource.types";
import type {
  CreateAiMentorLessonBody,
  CreateLessonBody,
  CreateQuizLessonBody,
  UpdateAiMentorLessonBody,
  UpdateLessonBody,
  UpdateQuizLessonBody,
  CreateEmbedLessonBody,
  UpdateEmbedLessonBody,
} from "../lesson.schema";
import type { EmbedLessonResourceType, LessonTypes } from "../lesson.type";
import type { SupportedLanguages } from "@repo/shared";
import type { LessonActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class AdminLessonService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private adminLessonRepository: AdminLessonRepository,
    private lessonRepository: LessonRepository,
    private aiRepository: AiRepository,
    private documentService: DocumentService,
    private fileService: FileService,
    private localizationService: LocalizationService,
    private lessonService: LessonService,
    private readonly eventBus: EventBus,
  ) {}

  async createLessonForChapter(data: CreateLessonBody, currentUser: CurrentUser) {
    await this.validateAccess("chapter", currentUser.role, currentUser.userId, data.chapterId);

    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.CHAPTER,
      data.chapterId,
    );

    if (data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    const lesson = await this.adminLessonRepository.createLessonForChapter(
      {
        ...data,
        displayOrder: maxDisplayOrder + 1,
      },
      language,
    );

    await this.adminLessonRepository.updateLessonCountForChapter(lesson.chapterId);

    const createdLessonSnapshot = await this.buildLessonActivitySnapshot(lesson.id, language);

    await this.eventBus.publish(
      new CreateLessonEvent({
        lessonId: lesson.id,
        actor: currentUser,
        createdLesson: createdLessonSnapshot,
      }),
    );

    return lesson.id;
  }

  async createAiMentorLesson(data: CreateAiMentorLessonBody, currentUser: CurrentUser) {
    await this.validateAccess("chapter", currentUser.role, currentUser.userId, data.chapterId);

    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.CHAPTER,
      data.chapterId,
    );

    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    if (data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
      throw new BadRequestException("Instructions and conditions required");

    if (!data.name?.trim().length) data.name = "AI Mentor";

    const lesson = await this.createAiMentorLessonWithTransaction(data, maxDisplayOrder + 1);

    await this.adminLessonRepository.updateLessonCountForChapter(data.chapterId);

    if (!lesson) throw new BadRequestException("Failed to create AI mentor lesson");

    const createdLessonSnapshot = await this.buildLessonActivitySnapshot(lesson.id, language);

    await this.eventBus.publish(
      new CreateLessonEvent({
        lessonId: lesson.id,
        actor: currentUser,
        createdLesson: createdLessonSnapshot,
      }),
    );

    return lesson.id;
  }

  async createQuizLesson(data: CreateQuizLessonBody, currentUser: CurrentUser) {
    await this.validateAccess("chapter", currentUser.role, currentUser.userId, data.chapterId);

    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    if (data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    if (!data.questions?.length) throw new BadRequestException("Questions are required");

    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.CHAPTER,
      data.chapterId,
    );

    const lesson = await this.createQuizLessonWithQuestionsAndOptions(
      data,
      currentUser.userId,
      language,
      maxDisplayOrder + 1,
    );

    await this.adminLessonRepository.updateLessonCountForChapter(data.chapterId);

    if (!lesson) throw new BadRequestException("Failed to create quiz lesson");

    const createdLessonSnapshot = await this.buildLessonActivitySnapshot(lesson.id, language);

    await this.eventBus.publish(
      new CreateLessonEvent({
        lessonId: lesson.id,
        actor: currentUser,
        createdLesson: createdLessonSnapshot,
      }),
    );

    return lesson.id;
  }
  async updateAiMentorLesson(
    id: UUIDType,
    data: UpdateAiMentorLessonBody,
    currentUser: CurrentUser,
  ) {
    await this.validateAccess("lesson", currentUser.role, currentUser.userId, id);

    const { availableLocales } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      id,
    );

    if (!availableLocales.includes(data.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const lesson = await this.lessonRepository.getLesson(id, data.language);

    if (data.title && data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
      throw new BadRequestException("Instructions and conditions required");

    const previousLessonSnapshot = await this.buildLessonActivitySnapshot(id, data.language);

    const updatedLesson = await this.updateAiMentorLessonWithTransaction(
      id,
      data,
      currentUser.userId,
    );

    const updatedLessonSnapshot = await this.buildLessonActivitySnapshot(id, data.language);

    await this.eventBus.publish(
      new UpdateLessonEvent({
        lessonId: id,
        actor: currentUser,
        previousLessonData: previousLessonSnapshot,
        updatedLessonData: updatedLessonSnapshot,
      }),
    );

    return updatedLesson?.id ?? id;
  }

  async updateQuizLesson(id: UUIDType, data: UpdateQuizLessonBody, currentUser: CurrentUser) {
    await this.validateAccess("lesson", currentUser.role, currentUser.userId, id);

    if (data.title && data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    const { availableLocales, baseLanguage } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      id,
    );

    if (!availableLocales.includes(data.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const lesson = await this.lessonRepository.getLesson(id, data.language);

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (!data.questions?.length) throw new BadRequestException("Questions are required");

    const previousLessonSnapshot = await this.buildLessonActivitySnapshot(id, data.language);

    const updatedLessonId = await this.updateQuizLessonWithQuestionsAndOptions(
      id,
      data,
      currentUser.userId,
      data.language,
      baseLanguage,
    );

    const updatedLessonSnapshot = await this.buildLessonActivitySnapshot(id, data.language);

    await this.eventBus.publish(
      new UpdateLessonEvent({
        lessonId: id,
        actor: currentUser,
        previousLessonData: previousLessonSnapshot,
        updatedLessonData: updatedLessonSnapshot,
      }),
    );

    return updatedLessonId;
  }

  async updateLesson(id: UUIDType, data: UpdateLessonBody, currentUser: CurrentUser) {
    await this.validateAccess("lesson", currentUser.role, currentUser.userId, id);

    const { availableLocales } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      id,
    );
    if (!availableLocales.includes(data.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const lesson = await this.lessonRepository.getLesson(id, data.language);

    if (data.title && data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const previousLessonSnapshot = await this.buildLessonActivitySnapshot(id, data.language);

    const updatedLesson = await this.adminLessonRepository.updateLesson(id, data);

    const updatedLessonSnapshot = await this.buildLessonActivitySnapshot(id, data.language);

    await this.eventBus.publish(
      new UpdateLessonEvent({
        lessonId: id,
        actor: currentUser,
        previousLessonData: previousLessonSnapshot,
        updatedLessonData: updatedLessonSnapshot,
      }),
    );

    return updatedLesson.id;
  }

  async removeLesson(lessonId: UUIDType, currentUser: CurrentUser) {
    await this.validateAccess("lesson", currentUser.role, currentUser.userId, lessonId);

    const [lesson] = await this.adminLessonRepository.getLesson(lessonId);

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    await this.db.transaction(async (trx) => {
      await this.documentService.deleteAllDocumentsIfLast(lessonId, trx);
      await this.adminLessonRepository.removeLesson(lessonId, trx);
      await this.adminLessonRepository.updateLessonDisplayOrderAfterRemove(lesson.chapterId, trx);
      await this.adminLessonRepository.updateLessonCountForChapter(lesson.chapterId, trx);
    });

    await this.eventBus.publish(
      new DeleteLessonEvent({
        lessonId: lesson.id,
        actor: currentUser,
        lessonName: lesson.title,
      }),
    );
  }

  async updateLessonDisplayOrder(lessonObject: {
    lessonId: UUIDType;
    displayOrder: number;
    currentUser: CurrentUser;
  }): Promise<void> {
    await this.validateAccess(
      "lesson",
      lessonObject.currentUser.role,
      lessonObject.currentUser.userId,
      lessonObject.lessonId,
    );

    const [lessonToUpdate] = await this.adminLessonRepository.getLesson(lessonObject.lessonId);

    const oldDisplayOrder = lessonToUpdate.displayOrder;
    if (!lessonToUpdate || oldDisplayOrder === null) {
      throw new NotFoundException("Lesson not found");
    }

    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      lessonObject.lessonId,
    );

    const previousLessonSnapshot = await this.buildLessonActivitySnapshot(
      lessonObject.lessonId,
      language,
    );

    await this.adminLessonRepository.updateLessonDisplayOrder(
      lessonToUpdate.chapterId,
      lessonToUpdate.id,
      lessonObject.displayOrder,
      oldDisplayOrder,
    );

    const updatedLessonSnapshot = await this.buildLessonActivitySnapshot(
      lessonObject.lessonId,
      language,
    );

    await this.eventBus.publish(
      new UpdateLessonEvent({
        lessonId: lessonObject.lessonId,
        actor: lessonObject.currentUser,
        previousLessonData: previousLessonSnapshot,
        updatedLessonData: updatedLessonSnapshot,
      }),
    );
  }

  private async createAiMentorLessonWithTransaction(
    data: CreateAiMentorLessonBody,
    displayOrder: number,
  ) {
    return await this.db.transaction(async (trx) => {
      const { language } = await this.localizationService.getBaseLanguage(
        ENTITY_TYPE.CHAPTER,
        data.chapterId,
      );

      const lesson = await this.adminLessonRepository.createAiMentorLesson(
        data,
        displayOrder,
        language,
        trx,
      );

      await this.adminLessonRepository.createAiMentorLessonData(
        {
          lessonId: lesson.id,
          aiMentorInstructions: data.aiMentorInstructions,
          completionConditions: data.completionConditions,
          type: data.type,
          name: data?.name,
        },
        trx,
      );

      return lesson;
    });
  }

  private async updateAiMentorLessonWithTransaction(
    id: UUIDType,
    data: UpdateAiMentorLessonBody,
    userId: UUIDType,
  ) {
    return await this.db.transaction(async (trx) => {
      const { type: _type, ...rest } = data;

      const { availableLocales } = await this.localizationService.getBaseLanguage(
        ENTITY_TYPE.LESSON,
        id,
      );

      if (!availableLocales.includes(data.language)) {
        throw new BadRequestException("This course does not support this language");
      }

      const [updatedLesson] = await this.adminLessonRepository.updateAiMentorLesson(id, rest, trx);

      if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
        throw new BadRequestException("Instructions and conditions required");

      if (data.name?.trim().length === 0) {
        data.name = "AI Mentor";
      }

      await this.adminLessonRepository.updateAiMentorLessonData(
        id,
        {
          aiMentorInstructions: data.aiMentorInstructions,
          completionConditions: data.completionConditions,
          type: data.type,
          name: data?.name,
        },
        trx,
      );

      await this.aiRepository.setThreadsToArchived(id, userId, trx);

      return updatedLesson;
    });
  }

  private async createQuizLessonWithQuestionsAndOptions(
    data: CreateQuizLessonBody,
    authorId: UUIDType,
    language: SupportedLanguages,
    displayOrder: number,
  ) {
    return await this.db.transaction(async (trx) => {
      const lesson = await this.adminLessonRepository.createQuizLessonWithQuestionsAndOptions(
        data,
        displayOrder,
        language,
        trx,
      );

      if (!data.questions) return;

      const questionsToInsert = data?.questions?.map((question) => ({
        lessonId: lesson.id,
        authorId,
        type: question.type,
        description: buildJsonbField(language, question.description),
        title: buildJsonbField(language, question.title),
        displayOrder: question.displayOrder,
        solutionExplanation: buildJsonbField(language, question.solutionExplanation),
        photoS3Key: question.photoS3Key,
      }));

      const insertedQuestions = await trx
        .insert(questions)
        .values(questionsToInsert)
        .returning({
          ...getTableColumns(questions),
          description: sql<string>`questions.description->>${language}`,
          title: sql<string>`questions.title->>${language}`,
          solutionExplanation: sql<string>`questions.solution_explanation->>${language}`,
        });

      const optionsToInsert = insertedQuestions.flatMap(
        (question, index) =>
          data.questions?.[index].options?.map((option) => ({
            questionId: question.id,
            optionText: buildJsonbField(language, option.optionText),
            isCorrect: option.isCorrect,
            displayOrder: option.displayOrder,
            matchedWord: buildJsonbField(language, option.matchedWord),
            scaleAnswer: option.scaleAnswer,
          })) || [],
      );

      if (optionsToInsert.length > 0) {
        await trx.insert(questionAnswerOptions).values(optionsToInsert);
      }

      return lesson;
    });
  }

  async updateQuizLessonWithQuestionsAndOptions(
    id: UUIDType,
    data: UpdateQuizLessonBody,
    currentUserId: UUIDType,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ) {
    return await this.db.transaction(async (trx) => {
      const { availableLocales } = await this.localizationService.getBaseLanguage(
        ENTITY_TYPE.LESSON,
        id,
      );

      if (!availableLocales.includes(data.language)) {
        throw new BadRequestException("This course does not support this language");
      }

      await this.adminLessonRepository.updateQuizLessonWithQuestionsAndOptions(id, data);

      const existingQuestions = await this.adminLessonRepository.getExistingQuestions(id, trx);
      const existingQuestionIds = existingQuestions.map((question) => question.id);

      const inputQuestionIds = data.questions
        ? data.questions.map((question) => question.id).filter(Boolean)
        : [];

      const isTranslating = language !== baseLanguage;

      if (existingQuestionIds.length !== inputQuestionIds.length && isTranslating) {
        throw new BadRequestException(
          "adminCourseView.toast.cannotModifyQuestionsInNonBaseLanguage",
        );
      }

      const questionsToDelete = existingQuestionIds.filter(
        (existingId) => !inputQuestionIds.includes(existingId),
      );

      if (questionsToDelete.length > 0) {
        if (isTranslating) {
          throw new BadRequestException(
            "adminCourseView.toast.cannotModifyQuestionsInNonBaseLanguage",
          );
        }
        await this.adminLessonRepository.deleteQuestions(questionsToDelete, trx);
        await this.adminLessonRepository.deleteQuestionOptions(questionsToDelete, trx);
      }

      if (data.questions) {
        for (const question of data.questions) {
          if (isTranslating) {
            if (!question.id || !existingQuestionIds.includes(question.id)) {
              throw new BadRequestException(
                "adminCourseView.toast.cannotModifyQuestionsInNonBaseLanguage",
              );
            }

            const existingQuestion = existingQuestions.find((q) => q.id === question.id);

            if (
              !existingQuestion ||
              existingQuestion.type !== question.type ||
              existingQuestion.displayOrder !== question.displayOrder
            ) {
              throw new BadRequestException(
                "adminCourseView.toast.cannotModifyQuestionsInNonBaseLanguage",
              );
            }
          }

          const questionData = {
            type: question.type,
            description: question.description || null,
            title: question.title,
            displayOrder: question.displayOrder,
            solutionExplanation: question.solutionExplanation,
            photoS3Key: question.photoS3Key,
            language: data.language,
          };

          const questionId = await this.adminLessonRepository.upsertQuestion(
            questionData,
            id,
            currentUserId,
            trx,
            question.id,
          );

          if (question.options) {
            const { existingOptions } = await this.adminLessonRepository.getExistingOptions(
              questionId,
              trx,
            );

            const existingOptionIds = existingOptions.map((option) => option.id);
            const inputOptionIds = question.options.map((option) => option.id).filter(Boolean);
            const optionsToDelete = existingOptionIds.filter(
              (existingId) => !inputOptionIds.includes(existingId),
            );

            if (optionsToDelete.length > 0) {
              if (isTranslating) {
                throw new BadRequestException(
                  "adminCourseView.toast.cannotModifyQuestionsInNonBaseLanguage",
                );
              }
              await this.adminLessonRepository.deleteOptions(optionsToDelete, trx);
            }

            for (const option of question.options) {
              if (isTranslating) {
                if (!option.id || !existingOptionIds.includes(option.id)) {
                  throw new BadRequestException(
                    "adminCourseView.toast.cannotModifyQuestionsInNonBaseLanguage",
                  );
                }

                const existingOption = existingOptions.find(
                  (existing) => existing.id === option.id,
                );

                if (!existingOption) {
                  throw new BadRequestException(
                    "adminCourseView.toast.cannotModifyQuestionsInNonBaseLanguage",
                  );
                }

                const incomingIsCorrect =
                  option.isCorrect === undefined ? existingOption.isCorrect : option.isCorrect;

                const isTrueOrFalseQuestion = question.type === "true_or_false";
                const isFillInTheBlank =
                  question.type === "fill_in_the_blanks_text" ||
                  question.type === "fill_in_the_blanks_dnd";
                const isCorrectChanged =
                  !isFillInTheBlank &&
                  incomingIsCorrect !== existingOption.isCorrect &&
                  (isTrueOrFalseQuestion || option.isCorrect !== undefined);

                const scaleChanged =
                  option.scaleAnswer !== undefined &&
                  existingOption.scaleAnswer !== option.scaleAnswer;

                if (isCorrectChanged || scaleChanged) {
                  throw new BadRequestException(
                    "adminCourseView.toast.cannotModifyQuestionsInNonBaseLanguage",
                  );
                }
              }

              const optionData = {
                optionText: option.optionText,
                isCorrect: option.isCorrect,
                displayOrder: option.displayOrder,
                matchedWord: option.matchedWord,
                scaleAnswer: option.scaleAnswer,
                language: data.language,
              };

              if (option.id) {
                const result = await this.adminLessonRepository.updateOption(
                  option.id,
                  optionData,
                  trx,
                );
                if (!result || result.length === 0) {
                  throw new BadRequestException(
                    `Failed to update option with ID: ${option.id} in question ${question.title} - ${question.type}`,
                  );
                }
              } else {
                const result = await this.adminLessonRepository.insertOption(
                  questionId,
                  optionData,
                  trx,
                );
                if (!result || result.length === 0) {
                  throw new BadRequestException("Failed to insert new option");
                }
              }
            }
          }
        }
      }

      return id;
    });
  }

  async createEmbedLesson(data: CreateEmbedLessonBody, currentUser: CurrentUser) {
    await this.validateAccess("chapter", currentUser.role, currentUser.userId, data.chapterId);

    if (data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.CHAPTER,
      data.chapterId,
    );

    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    const lesson = await this.adminLessonRepository.createLessonForChapter(
      {
        ...data,
        displayOrder: maxDisplayOrder + 1,
      },
      language,
    );

    if (!lesson) throw new BadRequestException("Failed to create embed lesson");

    await this.adminLessonRepository.updateLessonCountForChapter(lesson.chapterId);

    if (data.resources && data.resources.length > 0) {
      await this.adminLessonRepository.createLessonResources(
        lesson.id,
        data.resources.map((resource) => ({
          reference: resource.fileUrl,
          contentType: "text/html",
          metadata: {
            allowFullscreen: resource.allowFullscreen ?? false,
          },
          uploadedById: currentUser.userId,
        })),
      );
    }

    const createdLessonSnapshot = await this.buildLessonActivitySnapshot(lesson.id, language);

    await this.eventBus.publish(
      new CreateLessonEvent({
        lessonId: lesson.id,
        actor: currentUser,
        createdLesson: createdLessonSnapshot,
      }),
    );

    return lesson;
  }

  async updateEmbedLesson(
    lessonId: UUIDType,
    currentUser: CurrentUser,
    data: UpdateEmbedLessonBody,
  ) {
    await this.validateAccess("lesson", currentUser.role, currentUser.userId, lessonId);

    if (data.title && data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    const { availableLocales } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      lessonId,
    );

    if (!availableLocales.includes(data.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const lesson = await this.lessonRepository.getLesson(lessonId, data.language);

    if (!lesson) throw new NotFoundException("Lesson not found");

    const previousLessonSnapshot = await this.buildLessonActivitySnapshot(lessonId, data.language);

    const updatedLesson = await this.adminLessonRepository.updateLesson(lessonId, data);

    if (data.resources && data.resources.length === 0) {
      await this.adminLessonRepository.deleteLessonResources(lessonId);
    } else if (data.resources) {
      const existingResourcesIds = (
        await this.adminLessonRepository.getLessonResourcesForLesson(lessonId, data.language)
      ).map((r) => r.id);

      const resourceIdsToDelete = existingResourcesIds.filter(
        (existingId) =>
          !data.resources
            .map((res) => res.id)
            .filter((id): id is UUIDType => id !== undefined)
            .includes(existingId),
      );

      if (resourceIdsToDelete.length > 0)
        await this.adminLessonRepository.deleteLessonResourcesByIds(resourceIdsToDelete);

      const resourcesToUpdate = data.resources.reduce((acc, resource) => {
        if (resource.id && existingResourcesIds.includes(resource.id)) {
          acc.push({
            id: resource.id,
            reference: resource.fileUrl,
            contentType: "text/html",
            metadata: {
              allowFullscreen: resource.allowFullscreen ?? false,
            },
          });
        }

        return acc;
      }, [] as EmbedLessonResourceType[]);

      if (resourcesToUpdate.length > 0)
        await this.adminLessonRepository.updateLessonResources(resourcesToUpdate);

      const resourcesToCreate = data.resources.reduce(
        (acc, resource) => {
          if (!resource.id) {
            acc.push({
              reference: resource.fileUrl,
              contentType: "text/html",
              metadata: {
                allowFullscreen: resource.allowFullscreen ?? false,
              },
            });
          }

          return acc;
        },
        [] as Omit<EmbedLessonResourceType, "id">[],
      );

      if (resourcesToCreate.length > 0)
        await this.adminLessonRepository.createLessonResources(lessonId, resourcesToCreate);
    }

    const updatedLessonSnapshot = await this.buildLessonActivitySnapshot(lessonId, data.language);

    await this.eventBus.publish(
      new UpdateLessonEvent({
        lessonId,
        actor: currentUser,
        previousLessonData: previousLessonSnapshot,
        updatedLessonData: updatedLessonSnapshot,
      }),
    );

    return updatedLesson.id;
  }

  async uploadFileToLesson(
    lessonId: UUIDType,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
    file: Express.Multer.File,
    language: SupportedLanguages,
    title: string,
    description: string,
  ) {
    await this.validateAccess("lesson", currentUserRole, currentUserId, lessonId);

    const type = await FileGuard.getFileType(file);

    const fileTitle = {
      [language]: title,
    };

    const fileDescription = {
      [language]: description,
    };

    if (type?.mime && ALLOWED_VIDEO_FILE_TYPES.includes(type.mime)) {
      const lesson = await this.lessonRepository.getLesson(lessonId, language);

      const resources = await this.fileService.getResourcesForEntity(lessonId, ENTITY_TYPE.LESSON);

      const mappedResources = resources.map((resource) => ({
        id: resource.id,
        fileUrl: resource.fileUrl,
        contentType: resource.contentType,
        title: typeof resource.title === "string" ? resource.title : undefined,
        description: typeof resource.description === "string" ? resource.description : undefined,
        fileName: this.lessonService.extractOriginalFilename(resource.metadata),
      }));

      const { contentCount } = this.lessonService.injectResourcesIntoContent(
        lesson.description,
        mappedResources,
      );

      if (contentCount.video > 0) {
        throw new BadRequestException("adminCourseView.toast.maxOneVideoUploaded");
      }
    }

    const fileData = await this.fileService.uploadResource(
      file,
      "lesson-content",
      RESOURCE_CATEGORIES.LESSON,
      lessonId,
      ENTITY_TYPES.LESSON,
      RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      fileTitle,
      fileDescription,
      undefined,
    );

    return { resourceId: fileData.resourceId };
  }

  async uploadAvatarToAiMentorLesson(
    currentUserId: UUIDType,
    currentUserRole: UserRole,
    lessonId: UUIDType,
    file: Express.Multer.File | null,
  ) {
    const [course] = await this.adminLessonRepository.getCourseByLesson(lessonId);

    if (!(currentUserRole === USER_ROLES.ADMIN || course.authorId === currentUserId)) {
      throw new ForbiddenException({ message: "common.toast.noAccess" });
    }

    if (!file) {
      await this.adminLessonRepository.updateAiMentorAvatar(lessonId, null);
      return;
    }

    const type = await FileGuard.getFileType(file);

    if (type?.mime && !ALLOWED_AVATAR_IMAGE_TYPES.includes(type.mime)) {
      throw new BadRequestException({
        message: "adminCourseView.toast.aiMentorAvatarIncorrectType",
      });
    }

    const { fileKey } = await this.fileService.uploadFile(file, "lessons/ai-mentor-avatars");

    await this.adminLessonRepository.updateAiMentorAvatar(lessonId, fileKey);
  }

  private async buildLessonActivitySnapshot(
    lessonId: UUIDType,
    language: SupportedLanguages,
  ): Promise<LessonActivityLogSnapshot> {
    const [lesson] = await this.adminLessonRepository.getLesson(lessonId, language);

    if (!lesson) throw new NotFoundException("Lesson not found");

    const lessonResources = await this.fileService.getResourcesForEntity(
      lessonId,
      ENTITY_TYPES.LESSON,
      RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      language,
    );

    const questions =
      lesson.type === LESSON_TYPES.QUIZ
        ? await this.adminLessonRepository.getQuestionsWithOptions(lessonId, language)
        : [];

    return {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      type: lesson.type as LessonTypes,
      fileS3Key: lesson.fileS3Key,
      fileType: lesson.fileType,
      isExternal: lesson.isExternal ?? false,
      chapterId: lesson.chapterId,
      displayOrder: lesson.displayOrder,
      thresholdScore: lesson.thresholdScore,
      attemptsLimit: lesson.attemptsLimit,
      quizCooldownInHours: lesson.quizCooldownInHours,
      lessonResources: lessonResources.map((resource) => {
        const metadata = resource.metadata as LessonResourceMetadata | undefined;
        const fileName =
          metadata && typeof metadata.originalFilename === "string"
            ? metadata.originalFilename
            : undefined;

        return {
          id: resource.id,
          fileUrl: resource.fileUrl,
          contentType: resource.contentType,
          title: typeof resource.title === "string" ? resource.title : undefined,
          description: typeof resource.description === "string" ? resource.description : undefined,
          fileName,
          allowFullscreen: metadata?.allowFullscreen,
        };
      }),
      questions: questions.map((question) => ({
        id: question.id,
        title: question.title,
        description: question.description,
        solutionExplanation: question.solutionExplanation,
        type: question.type,
        photoS3Key: question.photoS3Key,
        displayOrder: question.displayOrder,
        options: question.options?.map((option) => ({
          id: option.id,
          optionText: option.optionText,
          isCorrect: option.isCorrect,
          displayOrder: option.displayOrder,
          matchedWord: option.matchedWord,
          scaleAnswer: option.scaleAnswer,
        })),
      })),
      aiMentor:
        lesson.type === LESSON_TYPES.AI_MENTOR
          ? {
              aiMentorInstructions: lesson.aiMentorInstructions,
              completionConditions: lesson.aiMentorCompletionConditions,
              name: lesson.aiMentorName,
              avatarReference: lesson.aiMentorAvatarReference,
              type: lesson.aiMentorType,
            }
          : undefined,
    };
  }

  async validateAccess(
    entity: "chapter" | "lesson" | "course",
    currentUserRole: UserRole,
    currentUserId: UUIDType,
    id: UUIDType,
    throwOnNoAccess: boolean = true,
  ) {
    let course;

    switch (entity) {
      case "lesson":
        [course] = await this.adminLessonRepository.getCourseByLesson(id);
        break;
      case "chapter":
        [course] = await this.adminLessonRepository.getCourseByChapter(id);
        break;

      case "course":
        [course] = await this.adminLessonRepository.getCourse(id);
    }

    if (!course) throw new NotFoundException("Course not found");

    const hasAccess = currentUserRole === USER_ROLES.ADMIN || course.authorId === currentUserId;

    if (throwOnNoAccess && !hasAccess) {
      throw new ForbiddenException({ message: "common.toast.noAccess" });
    }

    return hasAccess;
  }
}
