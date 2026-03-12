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
import { eq } from "drizzle-orm";
import { match } from "ts-pattern";

import { AdminChapterService } from "src/chapter/adminChapter.service";
import { AdminChapterRepository } from "src/chapter/repositories/adminChapter.repository";
import { EnvService } from "src/env/services/env.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { lessons } from "src/storage/schema";

import type {
  ChatOptions,
  CreateDraftOptions,
  DeleteIngestedDocumentOptions,
  GeneratedCourseResponse,
  IngestDraftFileResponse,
  IntegrationIdOptions,
} from "@japro/luma-sdk";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { AdminLessonWithContentSchema } from "src/lesson/lesson.schema";
import type { GeneratedChapter, GeneratedLesson } from "src/luma/schema/luma.schema";

type CreatedChapter = Awaited<ReturnType<AdminChapterService["createChapterForCourse"]>>;

type StreamState = {
  chapterIdsByIndex: Map<number, UUIDType>;
  chapterByEventKey: Map<string, CreatedChapter>;
  lessonByEventKey: Map<string, { type: string; lesson: Record<string, unknown> }>;
};

type ChunkContext = {
  integrationId: UUIDType;
  currentUser: CurrentUser;
  state: StreamState;
};

type LumaClient = ReturnType<typeof createLumaClient>;

@Injectable()
export class LumaService {
  constructor(
    private readonly envService: EnvService,
    private readonly adminLessonService: AdminLessonService,
    private readonly adminChapterService: AdminChapterService,
    private readonly adminChapterRepository: AdminChapterRepository,
    private readonly localizationService: LocalizationService,
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

  async getDraft(data: CreateDraftOptions, currentUser: CurrentUser) {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser);

    const draft = await luma.getDraft(data).catch((error) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        return undefined;
      }

      this.handleLumaSdkError(error);
    });

    if (!draft) {
      const { language } = await this.localizationService.getBaseLanguage(
        ENTITY_TYPE.COURSE,
        data.integrationId,
        data.courseLanguage as SupportedLanguages,
      );

      data.courseLanguage = language;

      const { draftId } = await this.withLumaErrorHandling(() => luma.createDraft(data));

      return { integrationId: data.integrationId, draftId, isCourseGenerated: false };
    }

    return { integrationId: data.integrationId, ...draft };
  }

  async chatWithCourseAgent(
    data: ChatOptions,
    currentUser: CurrentUser,
  ): Promise<Awaited<ReturnType<LumaClient["chat"]>>> {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser, {
      ensureCourseHasNoChapters: true,
    });

    return this.withLumaErrorHandling(() => luma.chat(data));
  }

  async getCourseGenerationMessages(data: IntegrationIdOptions, currentUser: CurrentUser) {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser);

    return this.withLumaErrorHandling(() => luma.getDraftMessages(data));
  }

  async ingestCourseGenerationFiles(
    data: IntegrationIdOptions,
    files: Express.Multer.File[],
    currentUser: CurrentUser,
  ): Promise<IngestDraftFileResponse[]> {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser, {
      ensureCourseHasNoChapters: true,
    });
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
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser, {
      ensureCourseHasNoChapters: true,
    });

    return this.withLumaErrorHandling(() => luma.deleteIngestedDocument(data));
  }

  async getCourseGenerationFiles(data: IntegrationIdOptions, currentUser: CurrentUser) {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser);

    return this.withLumaErrorHandling(() => luma.getDraftFiles(data));
  }

  createStreamState(): StreamState {
    return {
      chapterIdsByIndex: new Map<number, UUIDType>(),
      chapterByEventKey: new Map<string, CreatedChapter>(),
      lessonByEventKey: new Map<string, { type: string; lesson: Record<string, unknown> }>(),
    };
  }

  async handleChunk(chunk: Buffer, context?: ChunkContext) {
    const chunkString = chunk.toString();
    if (!context) return chunkString;

    const frames = chunkString.replace(/\r\n/g, "\n").split("\n");
    let output = "";

    for (const frame of frames) {
      if (!frame.trim()) continue;
      if (!frame.startsWith("2:")) {
        output += `${frame}\n`;
        continue;
      }

      const transformedFrames = await this.handleData(frame, context);
      for (const transformedFrame of transformedFrames) {
        output += `${transformedFrame}\n`;
      }
    }

    return output;
  }

  private async handleData(chunkString: string, context: ChunkContext) {
    const payloads = this.parseDataChunk(chunkString);

    if (!payloads.length) {
      return [chunkString];
    }

    const transformedFrames: string[] = [];

    for (const payload of payloads) {
      if (!payload || typeof payload !== "object" || !("type" in payload)) {
        transformedFrames.push(`2:${JSON.stringify([payload])}`);
        continue;
      }

      const transformedPayload = await match(payload.type)
        .with("designer.chapter.generated", async () => {
          const chapterPayload = payload as GeneratedChapter;
          const chapterEventKey = this.buildChapterEventKey(chapterPayload);
          const existingChapter = context.state.chapterByEventKey.get(chapterEventKey);
          if (existingChapter) {
            return {
              type: chapterPayload.type,
              chapter: existingChapter,
            };
          }

          const createdChapter = await this.adminChapterService.createChapterForCourse(
            {
              courseId: context.integrationId,
              title: this.sanitizeText(
                chapterPayload.generation?.title?.trim() || "Generated chapter",
              ),
              isFreemium: false,
            },
            context.currentUser,
          );

          context.state.chapterIdsByIndex.set(
            (createdChapter.displayOrder ?? 1) - 1,
            createdChapter.id,
          );
          context.state.chapterByEventKey.set(chapterEventKey, createdChapter);

          return {
            type: chapterPayload.type,
            chapter: createdChapter,
          };
        })
        .with("architect.lesson.generated", async () => {
          const lessonPayload = payload as GeneratedLesson;
          const lessonEventKey = this.buildLessonEventKey(lessonPayload);
          const existingLesson = context.state.lessonByEventKey.get(lessonEventKey);
          if (existingLesson) return existingLesson;

          const chapterId = context.state.chapterIdsByIndex.get(lessonPayload.chapterIndex);
          if (!chapterId) return payload;

          const lesson = await this.saveGeneratedLesson(
            chapterId,
            lessonPayload.generation,
            context.currentUser,
          );

          const transformedLesson = {
            type: lessonPayload.type,
            lesson,
          };

          context.state.lessonByEventKey.set(lessonEventKey, transformedLesson);
          return transformedLesson;
        })
        .otherwise(() => payload);

      transformedFrames.push(`2:${JSON.stringify([transformedPayload])}`);
    }

    return transformedFrames;
  }

  private async saveGeneratedLesson(
    chapterId: UUIDType,
    lesson: GeneratedCourseResponse["chapters"][number]["lessons"][number],
    currentUser: CurrentUser,
  ): Promise<AdminLessonWithContentSchema> {
    const lessonTitle = this.sanitizeText(lesson.title?.trim() || "Generated lesson");
    const lessonType = this.resolveGeneratedLessonType(lesson);
    let lessonId: UUIDType;

    if (lessonType === LESSON_TYPES.AI_MENTOR) {
      const aiMentor = lesson.aiMentor;

      lessonId = await this.adminLessonService.createAiMentorLesson(
        {
          chapterId,
          title: lessonTitle,
          description: this.sanitizeText(aiMentor?.taskDescription ?? lesson.content ?? ""),
          type: this.mapAiMentorType(aiMentor?.type),
          aiMentorInstructions: this.sanitizeText(aiMentor?.aiMentorInstructions ?? ""),
          completionConditions: this.sanitizeText(aiMentor?.completionConditions ?? ""),
          name: this.sanitizeText(aiMentor?.name ?? "AI Mentor"),
        },
        currentUser,
      );
    } else if (lessonType === LESSON_TYPES.QUIZ) {
      const questions = (lesson.questions ?? []).map((question, questionIndex) => ({
        type: this.mapQuestionType(question.type),
        title: this.sanitizeText(question.title?.trim() || `Question ${questionIndex + 1}`),
        description: this.sanitizeText(question.description ?? ""),
        solutionExplanation: this.sanitizeText(question.solutionExplanation ?? ""),
        displayOrder: question.questionIndex || questionIndex + 1,
        options: (question.options ?? []).map((option, optionIndex) => ({
          optionText: this.sanitizeText(option.optionText ?? ""),
          isCorrect: Boolean(option.isCorrect),
          displayOrder: option.optionIndex || optionIndex + 1,
        })),
      }));

      if (!questions.length) {
        lessonId = await this.createGeneratedContentLesson(
          chapterId,
          lessonTitle,
          this.sanitizeText(lesson.content ?? ""),
          currentUser,
        );
      } else {
        lessonId = await this.adminLessonService.createQuizLesson(
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
      }
    } else {
      lessonId = await this.createGeneratedContentLesson(
        chapterId,
        lessonTitle,
        this.sanitizeText(lesson.content ?? ""),
        currentUser,
      );
    }

    return this.getCreatedLessonById(chapterId, lessonId);
  }

  private async getCreatedLessonById(
    chapterId: UUIDType,
    lessonId: UUIDType,
  ): Promise<AdminLessonWithContentSchema> {
    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.CHAPTER,
      chapterId,
    );
    const [lesson] = await this.adminChapterRepository.getBetaChapterLessons(chapterId, language, [
      eq(lessons.id, lessonId),
    ]);

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    return { ...lesson, chapterId };
  }

  private resolveGeneratedLessonType(
    lesson: GeneratedCourseResponse["chapters"][number]["lessons"][number],
  ): (typeof LESSON_TYPES)[keyof typeof LESSON_TYPES] {
    const raw = (lesson as Record<string, unknown>).lessonType?.toString() ?? "";
    const normalized = raw.trim().toLowerCase();

    if (normalized === LESSON_TYPES.AI_MENTOR || normalized === "aimentor") {
      return LESSON_TYPES.AI_MENTOR;
    }

    if (normalized === LESSON_TYPES.QUIZ) {
      return LESSON_TYPES.QUIZ;
    }

    if (normalized === LESSON_TYPES.EMBED) {
      return LESSON_TYPES.EMBED;
    }

    return LESSON_TYPES.CONTENT;
  }

  private async createGeneratedContentLesson(
    chapterId: UUIDType,
    title: string,
    description: string,
    currentUser: CurrentUser,
  ) {
    return this.adminLessonService.createLessonForChapter(
      {
        chapterId,
        title: this.sanitizeText(title),
        description: this.sanitizeText(description),
        type: LESSON_TYPES.CONTENT,
      },
      currentUser,
    );
  }

  private sanitizeText(value: string): string {
    return value.replace(/\u0000/g, "");
  }

  private parseDataChunk(chunkString: string): unknown[] {
    const payload = chunkString.slice(2).trim();
    if (!payload) return [];

    try {
      const parsed = JSON.parse(payload);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  private buildChapterEventKey(payload: GeneratedChapter): string {
    return JSON.stringify({
      type: payload.type,
      generation: payload.generation ?? {},
    });
  }

  private buildLessonEventKey(payload: GeneratedLesson): string {
    return JSON.stringify({
      type: payload.type,
      chapterIndex: payload.chapterIndex,
      lessonIndex: payload.lessonIndex,
    });
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
        return QUESTION_TYPE.FILL_IN_THE_BLANKS_DND;
      case "GapFill":
        return QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT;
      case "BriefResponse":
      default:
        return QUESTION_TYPE.BRIEF_RESPONSE;
    }
  }

  private async validateCourseHasChapters(integrationId: UUIDType) {
    if (await this.adminLessonService.courseHasChapters(integrationId)) {
      throw new ConflictException("adminCourseView.toast.courseHasChapters");
    }
  }

  private async validateCourseAccess(integrationId: string, currentUser: CurrentUser) {
    await this.adminLessonService.validateAccess(
      ENTITY_TYPE.COURSE,
      currentUser.role,
      currentUser.userId,
      integrationId,
    );
  }

  private async getAuthorizedLumaClient(
    integrationId: UUIDType,
    currentUser: CurrentUser,
    options?: { ensureCourseHasNoChapters?: boolean },
  ) {
    await this.validateCourseAccess(integrationId, currentUser);

    if (options?.ensureCourseHasNoChapters) {
      await this.validateCourseHasChapters(integrationId);
    }

    return this.getLumaClient();
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
