import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { getTableColumns, sql } from "drizzle-orm";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { DocumentService } from "src/ingestion/services/document.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { questionAnswerOptions, questions } from "src/storage/schema";
import { isRichTextEmpty } from "src/utils/isRichTextEmpty";

import { LESSON_TYPES } from "../lesson.type";
import { AdminLessonRepository } from "../repositories/adminLesson.repository";
import { LessonRepository } from "../repositories/lesson.repository";

import type {
  CreateAiMentorLessonBody,
  CreateLessonBody,
  CreateQuizLessonBody,
  LessonResource,
  UpdateAiMentorLessonBody,
  UpdateLessonBody,
  UpdateQuizLessonBody,
  CreateEmbedLessonBody,
  UpdateEmbedLessonBody,
} from "../lesson.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class AdminLessonService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private adminLessonRepository: AdminLessonRepository,
    private lessonRepository: LessonRepository,
    private aiRepository: AiRepository,
    private documentService: DocumentService,
    private localizationService: LocalizationService,
  ) {}

  async createLessonForChapter(data: CreateLessonBody) {
    if (
      (data.type === LESSON_TYPES.PRESENTATION || data.type === LESSON_TYPES.VIDEO) &&
      (!data.fileS3Key || !data.fileType)
    ) {
      throw new BadRequestException("File is required for video and presentation lessons");
    }

    const { language } = await this.localizationService.getLanguageByEntity(
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

    await this.adminLessonRepository.updateLessonCountForChapter(lesson.chapterId);

    return lesson.id;
  }

  async createAiMentorLesson(data: CreateAiMentorLessonBody) {
    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
      throw new BadRequestException("Instructions and conditions required");

    const lesson = await this.createAiMentorLessonWithTransaction(data, maxDisplayOrder + 1);

    await this.adminLessonRepository.updateLessonCountForChapter(data.chapterId);

    return lesson?.id;
  }

  async createQuizLesson(data: CreateQuizLessonBody, authorId: UUIDType) {
    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    if (!data.questions?.length) throw new BadRequestException("Questions are required");

    const { language } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.CHAPTER,
      data.chapterId,
    );

    const lesson = await this.createQuizLessonWithQuestionsAndOptions(
      data,
      authorId,
      language,
      maxDisplayOrder + 1,
    );

    await this.adminLessonRepository.updateLessonCountForChapter(data.chapterId);

    return lesson?.id;
  }
  async updateAiMentorLesson(id: UUIDType, data: UpdateAiMentorLessonBody, userId: UUIDType) {
    const { availableLocales } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.LESSON,
      id,
    );

    if (!availableLocales.includes(data.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const lesson = await this.lessonRepository.getLesson(id, data.language);

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
      throw new BadRequestException("Instructions and conditions required");

    return await this.updateAiMentorLessonWithTransaction(id, data, userId);
  }

  async updateQuizLesson(id: UUIDType, data: UpdateQuizLessonBody, authorId: UUIDType) {
    const { availableLocales } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.LESSON,
      id,
    );

    if (!availableLocales.includes(data.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const lesson = await this.lessonRepository.getLesson(id, data.language);

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (!data.questions?.length) throw new BadRequestException("Questions are required");

    return await this.updateQuizLessonWithQuestionsAndOptions(id, data, authorId);
  }

  async updateLesson(id: UUIDType, data: UpdateLessonBody) {
    const { availableLocales } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.LESSON,
      id,
    );

    if (!availableLocales.includes(data.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const lesson = await this.lessonRepository.getLesson(id, data.language);

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    if (
      (data.type === LESSON_TYPES.PRESENTATION || data.type === LESSON_TYPES.VIDEO) &&
      (!data.fileS3Key || !data.fileType)
    ) {
      throw new BadRequestException("File is required for video and presentation lessons");
    }

    const updatedLesson = await this.adminLessonRepository.updateLesson(id, data);
    return updatedLesson.id;
  }

  async removeLesson(lessonId: UUIDType) {
    const { language } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.LESSON,
      lessonId,
    );

    const [lesson] = await this.adminLessonRepository.getLesson(lessonId, language);

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    await this.db.transaction(async (trx) => {
      await this.documentService.deleteAllDocumentsIfLast(lessonId, trx);
      await this.adminLessonRepository.removeLesson(lessonId, trx);
      await this.adminLessonRepository.updateLessonDisplayOrderAfterRemove(lesson.chapterId, trx);
      await this.adminLessonRepository.updateLessonCountForChapter(lesson.chapterId, trx);
    });
  }

  async updateLessonDisplayOrder(lessonObject: {
    lessonId: UUIDType;
    displayOrder: number;
  }): Promise<void> {
    const { language } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.LESSON,
      lessonObject.lessonId,
    );

    const [lessonToUpdate] = await this.adminLessonRepository.getLesson(
      lessonObject.lessonId,
      language,
    );

    const oldDisplayOrder = lessonToUpdate.displayOrder;
    if (!lessonToUpdate || oldDisplayOrder === null) {
      throw new NotFoundException("Lesson not found");
    }

    await this.adminLessonRepository.updateLessonDisplayOrder(
      lessonToUpdate.chapterId,
      lessonToUpdate.id,
      lessonObject.displayOrder,
      oldDisplayOrder,
    );
  }

  private async createAiMentorLessonWithTransaction(
    data: CreateAiMentorLessonBody,
    displayOrder: number,
  ) {
    return await this.db.transaction(async (trx) => {
      const { language } = await this.localizationService.getLanguageByEntity(
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

      const { availableLocales } = await this.localizationService.getLanguageByEntity(
        ENTITY_TYPE.LESSON,
        id,
      );

      if (!availableLocales.includes(data.language)) {
        throw new BadRequestException("This course does not support this language");
      }

      const updatedLesson = await this.adminLessonRepository.updateAiMentorLesson(id, rest, trx);

      if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
        throw new BadRequestException("Instructions and conditions required");

      await this.adminLessonRepository.updateAiMentorLessonData(
        id,
        {
          aiMentorInstructions: data.aiMentorInstructions,
          completionConditions: data.completionConditions,
          type: data.type,
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
    authorId: UUIDType,
  ) {
    return await this.db.transaction(async (trx) => {
      const { availableLocales } = await this.localizationService.getLanguageByEntity(
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

      const questionsToDelete = existingQuestionIds.filter(
        (existingId) => !inputQuestionIds.includes(existingId),
      );

      if (questionsToDelete.length > 0) {
        await this.adminLessonRepository.deleteQuestions(questionsToDelete, trx);
        await this.adminLessonRepository.deleteQuestionOptions(questionsToDelete, trx);
      }

      if (data.questions) {
        for (const question of data.questions) {
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
            authorId,
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
              await this.adminLessonRepository.deleteOptions(optionsToDelete, trx);
            }

            for (const option of question.options) {
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

  async createEmbedLesson(data: CreateEmbedLessonBody) {
    const { language } = await this.localizationService.getLanguageByEntity(
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
      const resourcesToInsert = data.resources.map((resource: LessonResource, index) => ({
        lessonId: lesson.id,
        type: resource.type,
        source: resource.source,
        isExternal: resource.isExternal,
        allowFullscreen: resource.allowFullscreen,
        displayOrder: index + 1,
      }));

      await this.adminLessonRepository.createLessonResources(resourcesToInsert);
    }

    return lesson;
  }

  async updateEmbedLesson(lessonId: UUIDType, data: UpdateEmbedLessonBody) {
    const { availableLocales } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.LESSON,
      lessonId,
    );

    if (!availableLocales.includes(data.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const lesson = await this.lessonRepository.getLesson(lessonId, data.language);

    if (!lesson) throw new NotFoundException("Lesson not found");

    const updatedLesson = await this.adminLessonRepository.updateLesson(lessonId, data);

    if (data.resources && data.resources.length === 0) {
      await this.adminLessonRepository.deleteLessonResources(lessonId);
      return updatedLesson.id;
    }

    const existingResourcesIds = (
      await this.adminLessonRepository.getLessonResourcesForLesson(lessonId)
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

    const resourcesToUpdate = data.resources.map((resource: LessonResource, index) => ({
      ...resource,
      lessonId,
      displayOrder: index + 1,
    }));

    if (resourcesToUpdate.length > 0)
      await this.adminLessonRepository.upsertLessonResources(resourcesToUpdate);

    return updatedLesson.id;
  }
}
