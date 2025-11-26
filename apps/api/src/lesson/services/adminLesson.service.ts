import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ALLOWED_AVATAR_IMAGE_TYPES, ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { DatabasePg } from "src/common";
import { FileService } from "src/file/file.service";
import { DocumentService } from "src/ingestion/services/document.service";
import { questionAnswerOptions, questions } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { isRichTextEmpty } from "src/utils/isRichTextEmpty";

import { LESSON_TYPES } from "../lesson.type";
import { AdminLessonRepository } from "../repositories/adminLesson.repository";
import { MAX_LESSON_TITLE_LENGTH } from "../repositories/lesson.constants";
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
import type { UUIDType } from "src/common";
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
  ) {}

  async createLessonForChapter(
    data: CreateLessonBody,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ) {
    await this.validateAccess("chapter", currentUserRole, currentUserId, data.chapterId);

    if (
      (data.type === LESSON_TYPES.PRESENTATION || data.type === LESSON_TYPES.VIDEO) &&
      (!data.fileS3Key || !data.fileType)
    ) {
      throw new BadRequestException("File is required for video and presentation lessons");
    }

    if (data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    const lesson = await this.adminLessonRepository.createLessonForChapter({
      ...data,
      displayOrder: maxDisplayOrder + 1,
    });

    await this.adminLessonRepository.updateLessonCountForChapter(lesson.chapterId);

    return lesson.id;
  }

  async createAiMentorLesson(
    data: CreateAiMentorLessonBody,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ) {
    await this.validateAccess("chapter", currentUserRole, currentUserId, data.chapterId);

    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    if (data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
      throw new BadRequestException("Instructions and conditions required");

    const lesson = await this.createAiMentorLessonWithTransaction(data, maxDisplayOrder + 1);

    await this.adminLessonRepository.updateLessonCountForChapter(data.chapterId);

    return lesson?.id;
  }

  async createQuizLesson(
    data: CreateQuizLessonBody,
    authorId: UUIDType,
    currentUserRole: UserRole,
  ) {
    await this.validateAccess("chapter", currentUserRole, authorId, data.chapterId);

    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    if (data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    if (!data.questions?.length) throw new BadRequestException("Questions are required");

    const lesson = await this.createQuizLessonWithQuestionsAndOptions(
      data,
      authorId,
      maxDisplayOrder + 1,
    );

    await this.adminLessonRepository.updateLessonCountForChapter(data.chapterId);

    return lesson?.id;
  }
  async updateAiMentorLesson(
    id: UUIDType,
    data: UpdateAiMentorLessonBody,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ) {
    await this.validateAccess("lesson", currentUserRole, currentUserId, id);

    const lesson = await this.lessonRepository.getLesson(id);

    if (data.title && data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
      throw new BadRequestException("Instructions and conditions required");

    return await this.updateAiMentorLessonWithTransaction(id, data, currentUserId);
  }

  async updateQuizLesson(
    id: UUIDType,
    data: UpdateQuizLessonBody,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ) {
    await this.validateAccess("lesson", currentUserRole, currentUserId, id);

    const lesson = await this.lessonRepository.getLesson(id);

    if (data.title && data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (!data.questions?.length) throw new BadRequestException("Questions are required");

    return this.updateQuizLessonWithQuestionsAndOptions(id, data, currentUserId);
  }

  async updateLesson(
    id: UUIDType,
    data: UpdateLessonBody,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ) {
    await this.validateAccess("lesson", currentUserRole, currentUserId, id);

    const lesson = await this.lessonRepository.getLesson(id);

    if (data.title && data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

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

  async removeLesson(lessonId: UUIDType, currentUserId: UUIDType, currentUserRole: UserRole) {
    await this.validateAccess("lesson", currentUserRole, currentUserId, lessonId);

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
  }

  async updateLessonDisplayOrder(lessonObject: {
    lessonId: UUIDType;
    displayOrder: number;
    currentUserId: UUIDType;
    currentUserRole: UserRole;
  }): Promise<void> {
    await this.validateAccess(
      "lesson",
      lessonObject.currentUserRole,
      lessonObject.currentUserId,
      lessonObject.lessonId,
    );

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

      const updatedLesson = await this.adminLessonRepository.updateAiMentorLesson(id, rest, trx);

      if (isRichTextEmpty(data.aiMentorInstructions) || isRichTextEmpty(data.completionConditions))
        throw new BadRequestException("Instructions and conditions required");

      if (data.name?.length === 0) {
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
    currentUserId: UUIDType,
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

  async createEmbedLesson(
    data: CreateEmbedLessonBody,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ) {
    await this.validateAccess("chapter", currentUserRole, currentUserId, data.chapterId);

    const maxDisplayOrder = await this.adminLessonRepository.getMaxDisplayOrder(data.chapterId);

    if (data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    const lesson = await this.adminLessonRepository.createLessonForChapter({
      ...data,
      displayOrder: maxDisplayOrder + 1,
    });

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

  async updateEmbedLesson(
    lessonId: UUIDType,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
    data: UpdateEmbedLessonBody,
  ) {
    await this.validateAccess("lesson", currentUserRole, currentUserId, lessonId);

    const lesson = await this.lessonRepository.getLesson(lessonId);

    if (data.title && data.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

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

  async uploadFileToLesson(
    lessonId: UUIDType,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
    file: Express.Multer.File,
  ) {
    await this.validateAccess("lesson", currentUserRole, currentUserId, lessonId);

    if (!ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Invalid file type");
    }

    const uploadedFile = await this.fileService.uploadFile(file, "lesson");

    const [resource] = await this.adminLessonRepository.createLessonResources([
      {
        source: uploadedFile.fileKey,
        type: "text",
        lessonId,
      },
    ]);

    return resource.id;
  }

  async uploadAvatarToAiMentorLesson(
    currentUserId: UUIDType,
    currentUserRole: UserRole,
    lessonId: UUIDType,
    file: Express.Multer.File | null,
  ) {
    const [course] = await this.adminLessonRepository.getCourseByLesson(lessonId);

    if (!file) {
      await this.adminLessonRepository.updateAiMentorAvatar(lessonId, null);
      return;
    }

    if (!(currentUserRole === USER_ROLES.ADMIN && course.authorId === currentUserId)) {
      throw new ForbiddenException({ message: "common.toast.noAccess" });
    }

    if (!ALLOWED_AVATAR_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException({
        message: "adminCourseView.toast.aiMentorAvatarIncorrectType",
      });
    }

    const { fileKey } = await this.fileService.uploadFile(file, "lessons/ai-mentor-avatars");

    await this.adminLessonRepository.updateAiMentorAvatar(lessonId, fileKey);
  }

  async validateAccess(
    entity: "chapter" | "lesson" | "course",
    currentUserRole: UserRole,
    currentUserId: UUIDType,
    id: UUIDType,
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

    if (!(currentUserRole === USER_ROLES.ADMIN || course.authorId === currentUserId)) {
      throw new ForbiddenException({ message: "common.toast.noAccess" });
    }
  }
}
