import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DatabasePg } from "src/common";
import { questionAnswerOptions, questions } from "src/storage/schema";
import { isRichTextEmpty } from "src/utils/isRichTextEmpty";

import { LESSON_TYPES } from "../lesson.type";
import { AdminLessonRepository } from "../repositories/adminLesson.repository";
import { LessonRepository } from "../repositories/lesson.repository";

import type {
  CreateAiMentorLessonBody,
  CreateLessonBody,
  CreateQuizLessonBody,
  UpdateAiMentorLessonBody,
  UpdateLessonBody,
  UpdateQuizLessonBody,
} from "../lesson.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class AdminLessonService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private adminLessonRepository: AdminLessonRepository,
    private lessonRepository: LessonRepository,
  ) {}

  async createLessonForChapter(data: CreateLessonBody) {
    if (
      (data.type === LESSON_TYPES.PRESENTATION || data.type === LESSON_TYPES.VIDEO) &&
      (!data.fileS3Key || !data.fileType)
    ) {
      throw new BadRequestException("File is required for video and presentation lessons");
    }

    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    const lesson = await this.adminLessonRepository.createLessonForChapter({
      ...data,
      displayOrder: maxDisplayOrder + 1,
    });

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

    const lesson = await this.createQuizLessonWithQuestionsAndOptions(
      data,
      authorId,
      maxDisplayOrder + 1,
    );

    await this.adminLessonRepository.updateLessonCountForChapter(data.chapterId);

    return lesson?.id;
  }
  async updateAiMentorLesson(id: UUIDType, data: UpdateAiMentorLessonBody) {
    const lesson = await this.lessonRepository.getLesson(id);

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
      throw new BadRequestException("Instructions and conditions required");

    const updatedLessonId = await this.updateAiMentorLessonWithTransaction(id, data);
    return updatedLessonId;
  }

  async updateQuizLesson(id: UUIDType, data: UpdateQuizLessonBody, authorId: UUIDType) {
    const lesson = await this.lessonRepository.getLesson(id);

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (!data.questions?.length) throw new BadRequestException("Questions are required");

    const updatedLessonId = await this.updateQuizLessonWithQuestionsAndOptions(id, data, authorId);
    return updatedLessonId;
  }

  async updateLesson(id: UUIDType, data: UpdateLessonBody) {
    const lesson = await this.lessonRepository.getLesson(id);

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
    const [lesson] = await this.adminLessonRepository.getLesson(lessonId);

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    await this.db.transaction(async (trx) => {
      await this.adminLessonRepository.removeLesson(lessonId, trx);
      await this.adminLessonRepository.updateLessonDisplayOrderAfterRemove(lesson.chapterId, trx);
      await this.adminLessonRepository.updateLessonCountForChapter(lesson.chapterId, trx);
    });
  }

  async updateLessonDisplayOrder(lessonObject: {
    lessonId: UUIDType;
    displayOrder: number;
  }): Promise<void> {
    const [lessonToUpdate] = await this.adminLessonRepository.getLesson(lessonObject.lessonId);

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
      const lesson = await this.adminLessonRepository.createAiMentorLesson(data, displayOrder, trx);

      await this.adminLessonRepository.createAiMentorLessonData(
        {
          lessonId: lesson.id,
          aiMentorInstructions: data.aiMentorInstructions,
          completionConditions: data.completionConditions,
        },
        trx,
      );

      return lesson;
    });
  }

  private async updateAiMentorLessonWithTransaction(id: UUIDType, data: UpdateAiMentorLessonBody) {
    return await this.db.transaction(async (trx) => {
      const updatedLesson = await this.adminLessonRepository.updateAiMentorLesson(id, data, trx);

      if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
        throw new BadRequestException("Instructions and conditions required");

      await this.adminLessonRepository.updateAiMentorLessonData(
        id,
        {
          aiMentorInstructions: data.aiMentorInstructions,
          completionConditions: data.completionConditions,
        },
        trx,
      );

      return updatedLesson;
    });
  }

  private async createQuizLessonWithQuestionsAndOptions(
    data: CreateQuizLessonBody,
    authorId: UUIDType,
    displayOrder: number,
  ) {
    return await this.db.transaction(async (trx) => {
      const lesson = await this.adminLessonRepository.createQuizLessonWithQuestionsAndOptions(
        data,
        displayOrder,
        trx,
      );

      if (!data.questions) return;

      const questionsToInsert = data?.questions?.map((question) => ({
        lessonId: lesson.id,
        authorId,
        type: question.type,
        description: question.description || null,
        title: question.title,
        displayOrder: question.displayOrder,
        solutionExplanation: question.solutionExplanation,
        photoS3Key: question.photoS3Key,
      }));

      const insertedQuestions = await trx.insert(questions).values(questionsToInsert).returning();

      const optionsToInsert = insertedQuestions.flatMap(
        (question, index) =>
          data.questions?.[index].options?.map((option) => ({
            questionId: question.id,
            optionText: option.optionText,
            isCorrect: option.isCorrect,
            displayOrder: option.displayOrder,
            matchedWord: option.matchedWord,
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
}
