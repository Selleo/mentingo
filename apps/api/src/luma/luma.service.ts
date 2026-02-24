import { createLumaClient } from "@japro/luma-sdk";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { AI_MENTOR_TYPE } from "@repo/shared";
import { isAxiosError } from "axios";

import { AdminChapterService } from "src/chapter/adminChapter.service";
import { EnvService } from "src/env/services/env.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { QUESTION_TYPE } from "src/questions/schema/question.types";

import type {
  ChatOptions,
  CreateDraftOptions,
  DeleteIngestedDocumentOptions,
  GeneratedCourseResponse,
  IngestDraftFileResponse,
  IntegrationIdOptions,
} from "@japro/luma-sdk";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { SaveGeneratedCourseBody } from "src/luma/schema/luma.schema";

@Injectable()
export class LumaService {
  constructor(
    private readonly envService: EnvService,
    private readonly adminLessonService: AdminLessonService,
    private readonly adminChapterService: AdminChapterService,
  ) {}

  async getLumaClient() {
    const apiKey = await this.envService
      .getEnv("LUMA_API_KEY")
      .then((r) => r.value)
      .catch(() => undefined);
    const baseURL = process.env.LUMA_BASE_URL;

    if (!baseURL || !apiKey) {
      throw new BadRequestException("adminCourseView.toast.lumaNotConfigured");
    }

    return createLumaClient({
      apiKey,
      baseURL,
    });
  }

  async saveGeneratedCourse(data: SaveGeneratedCourseBody, currentUser: CurrentUser) {
    await this.validateCourseAccess(data.integrationId, currentUser);
    await this.validateCourseHasChapters(data.integrationId);

    const luma = await this.getLumaClient();
    const generatedCourse = await this.withLumaErrorHandling(() =>
      luma.getGeneratedCourse({ integrationId: data.integrationId }),
    );

    const sortedChapters = [...generatedCourse.chapters].sort(
      (a, b) => a.chapterIndex - b.chapterIndex,
    );

    for (const chapter of sortedChapters) {
      const { id: chapterId } = await this.adminChapterService.createChapterForCourse(
        {
          courseId: data.integrationId,
          title: chapter.title?.trim() || `Chapter ${chapter.chapterIndex + 1}`,
          isFreemium: false,
        },
        currentUser,
      );

      for (const lesson of chapter.lessons) {
        await this.saveGeneratedLesson(chapterId, lesson, currentUser);
      }
    }

    return {
      integrationId: data.integrationId,
      chapterCount: generatedCourse.chapters.length,
    };
  }

  async getDraft(data: CreateDraftOptions, currentUser: CurrentUser) {
    await this.validateCourseAccess(data.integrationId, currentUser);
    const luma = await this.getLumaClient();

    const draft = await luma.getDraft(data).catch((error) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        return undefined;
      }

      this.handleLumaSdkError(error);
    });

    if (!draft) {
      const { draftId } = await this.withLumaErrorHandling(() => luma.createDraft(data));

      return { integrationId: data.integrationId, draftId, isCourseGenerated: false };
    }

    return { integrationId: data.integrationId, ...draft };
  }

  async chatWithCourseAgent(
    data: ChatOptions,
    currentUser: CurrentUser,
  ): Promise<Awaited<ReturnType<ReturnType<typeof createLumaClient>["chat"]>>> {
    await this.validateCourseAccess(data.integrationId, currentUser);
    await this.validateCourseHasChapters(data.integrationId);

    const luma = await this.getLumaClient();

    return this.withLumaErrorHandling(() => luma.chat(data));
  }

  async getCourseGenerationMessages(data: IntegrationIdOptions, currentUser: CurrentUser) {
    await this.validateCourseAccess(data.integrationId, currentUser);

    const luma = await this.getLumaClient();

    return this.withLumaErrorHandling(() => luma.getDraftMessages(data));
  }

  async ingestCourseGenerationFiles(
    data: IntegrationIdOptions,
    files: Express.Multer.File[],
    currentUser: CurrentUser,
  ): Promise<IngestDraftFileResponse[]> {
    await this.validateCourseAccess(data.integrationId, currentUser);
    await this.validateCourseHasChapters(data.integrationId);

    const luma = await this.getLumaClient();
    const responses: IngestDraftFileResponse[] = [];

    for (const file of files) {
      const lumaFile = new File([file.buffer], file.originalname, { type: file.mimetype });

      responses.push(
        await this.withLumaErrorHandling(() =>
          luma.ingestDraftFile({
            integrationId: data.integrationId,
            file: lumaFile,
          }),
        ),
      );
    }

    return responses;
  }

  async deleteCourseGenerationFile(data: DeleteIngestedDocumentOptions, currentUser: CurrentUser) {
    await this.validateCourseAccess(data.integrationId, currentUser);
    await this.validateCourseHasChapters(data.integrationId);

    const luma = await this.getLumaClient();

    return this.withLumaErrorHandling(() => luma.deleteIngestedDocument(data));
  }

  async getCourseGenerationFiles(data: IntegrationIdOptions, currentUser: CurrentUser) {
    await this.validateCourseAccess(data.integrationId, currentUser);

    const luma = await this.getLumaClient();

    return this.withLumaErrorHandling(() => luma.getDraftFiles(data));
  }

  private async saveGeneratedLesson(
    chapterId: UUIDType,
    lesson: GeneratedCourseResponse["chapters"][number]["lessons"][number],
    currentUser: CurrentUser,
  ) {
    const lessonTitle = lesson.title?.trim() || "Generated lesson";

    if (lesson.lessonType === "AI_MENTOR") {
      const aiMentor = lesson.aiMentor;

      await this.adminLessonService.createAiMentorLesson(
        {
          chapterId,
          title: lessonTitle,
          description: aiMentor?.taskDescription ?? lesson.content ?? "",
          type: this.mapAiMentorType(aiMentor?.type),
          aiMentorInstructions: aiMentor?.aiMentorInstructions ?? "",
          completionConditions: aiMentor?.completionConditions ?? "",
          name: aiMentor?.name ?? "AI Mentor",
        },
        currentUser,
      );
      return;
    }

    if (lesson.lessonType === "QUIZ") {
      const questions = (lesson.questions ?? []).map((question, questionIndex) => ({
        type: this.mapQuestionType(question.type),
        title: question.title?.trim() || `Question ${questionIndex + 1}`,
        description: question.description ?? "",
        solutionExplanation: question.solutionExplanation ?? "",
        displayOrder: question.questionIndex || questionIndex + 1,
        options: (question.options ?? []).map((option, optionIndex) => ({
          optionText: option.optionText ?? "",
          isCorrect: Boolean(option.isCorrect),
          displayOrder: option.optionIndex || optionIndex + 1,
        })),
      }));

      if (!questions.length) {
        await this.createGeneratedContentLesson(
          chapterId,
          lessonTitle,
          lesson.content ?? "",
          currentUser,
        );
        return;
      }

      await this.adminLessonService.createQuizLesson(
        {
          chapterId,
          title: lessonTitle,
          type: LESSON_TYPES.QUIZ,
          thresholdScore: 0,
          attemptsLimit: null,
          quizCooldownInHours: null,
          questions,
        },
        currentUser,
      );
      return;
    }

    await this.createGeneratedContentLesson(
      chapterId,
      lessonTitle,
      lesson.content ?? "",
      currentUser,
    );
  }

  private async createGeneratedContentLesson(
    chapterId: UUIDType,
    title: string,
    description: string,
    currentUser: CurrentUser,
  ) {
    await this.adminLessonService.createLessonForChapter(
      {
        chapterId,
        title,
        description,
        type: LESSON_TYPES.CONTENT,
      },
      currentUser,
    );
  }

  private mapAiMentorType(type: "ROLEPLAY" | "MENTOR" | "TEACHER" | undefined) {
    if (type === "ROLEPLAY") return AI_MENTOR_TYPE.ROLEPLAY;
    if (type === "TEACHER") return AI_MENTOR_TYPE.TEACHER;
    return AI_MENTOR_TYPE.MENTOR;
  }

  private mapQuestionType(
    type:
      | "SingleSelect"
      | "MultiSelect"
      | "TrueOrFalse"
      | "BriefResponse"
      | "DetailedResponse"
      | "FillInTheBlanks"
      | "GapFill",
  ) {
    switch (type) {
      case "SingleSelect":
        return QUESTION_TYPE.SINGLE_CHOICE;
      case "MultiSelect":
        return QUESTION_TYPE.MULTIPLE_CHOICE;
      case "TrueOrFalse":
        return QUESTION_TYPE.TRUE_OR_FALSE;
      case "DetailedResponse":
        return QUESTION_TYPE.DETAILED_RESPONSE;
      case "FillInTheBlanks":
        return QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT;
      case "GapFill":
        return QUESTION_TYPE.FILL_IN_THE_BLANKS_DND;
      case "BriefResponse":
      default:
        return QUESTION_TYPE.BRIEF_RESPONSE;
    }
  }

  private async validateCourseHasChapters(integrationId: UUIDType) {
    if (await this.courseHasChapters(integrationId)) {
      throw new ConflictException("adminCourseView.toast.courseHasChapters");
    }
  }

  private async courseHasChapters(integrationId: UUIDType) {
    return this.adminLessonService.courseHasChapters(integrationId);
  }

  private async validateCourseAccess(integrationId: string, currentUser: CurrentUser) {
    await this.adminLessonService.validateAccess(
      ENTITY_TYPE.COURSE,
      currentUser.role,
      currentUser.userId,
      integrationId,
    );
  }

  private async withLumaErrorHandling<T>(cb: () => Promise<T>): Promise<T> {
    try {
      return await cb();
    } catch (error) {
      this.handleLumaSdkError(error);
    }
  }

  private handleLumaSdkError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (!isAxiosError(error)) {
      throw new ServiceUnavailableException("adminCourseView.toast.lumaServiceUnavailable");
    }

    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        throw new ServiceUnavailableException("adminCourseView.toast.lumaRequestTimeout");
      }

      throw new ServiceUnavailableException("adminCourseView.toast.lumaServiceUnavailable");
    }

    const status = error.response.status;

    if (status === 400) {
      throw new BadRequestException("adminCourseView.toast.lumaBadRequest");
    }

    if (status === 401 || status === 403) {
      throw new UnauthorizedException("adminCourseView.toast.lumaUnauthorized");
    }

    if (status === 404) {
      throw new NotFoundException("adminCourseView.toast.lumaResourceNotFound");
    }

    if (status === 408 || status === 504) {
      throw new ServiceUnavailableException("adminCourseView.toast.lumaRequestTimeout");
    }

    if (status === 409) {
      throw new ConflictException("adminCourseView.toast.lumaConflict");
    }

    if (status === 422) {
      throw new BadRequestException("adminCourseView.toast.lumaValidationFailed");
    }

    if (status === 429) {
      throw new ServiceUnavailableException("adminCourseView.toast.lumaRateLimited");
    }

    throw new ServiceUnavailableException("adminCourseView.toast.lumaServiceUnavailable");
  }
}
