import { randomUUID } from "node:crypto";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type { SupportedLanguages } from "@repo/shared";
import type {
  BetaCreateAiMentorLessonBody,
  BetaCreateChapterBody,
  BetaCreateLessonBody,
  BetaCreateQuizLessonBody,
  BetaUpdateLessonBody,
  BetaUpdateQuizLessonBody,
  CreateEmbedLessonBody,
  GetBetaCourseByIdResponse,
  GetChapterWithLessonResponse,
  UpdateChapterBody,
  UpdateEmbedLessonBody,
} from "~/api/generated-api";

export type CurriculumCourseRecord = GetBetaCourseByIdResponse["data"];
export type CurriculumChapterRecord = GetChapterWithLessonResponse["data"];
export type CurriculumCourseChapterRecord = CurriculumCourseRecord["chapters"][number];
export type CurriculumCourseLessonRecord = NonNullable<
  CurriculumCourseChapterRecord["lessons"]
>[number];

type CreateChapterInput = Partial<BetaCreateChapterBody> & {
  courseId: string;
};

type CreateContentLessonInput = Partial<BetaCreateLessonBody> & {
  chapterId: string;
};

type CreateQuizLessonInput = Partial<BetaCreateQuizLessonBody> & {
  chapterId: string;
};

type CreateAiMentorLessonInput = Partial<BetaCreateAiMentorLessonBody> & {
  chapterId: string;
};

const createTitle = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

export class CurriculumFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async getCourse(courseId: string, language: SupportedLanguages = "en") {
    const response = await this.apiClient.api.courseControllerGetBetaCourseById({
      id: courseId,
      language,
    });

    return response.data.data;
  }

  async createChapter(input: CreateChapterInput): Promise<CurriculumCourseChapterRecord> {
    const title = input.title ?? createTitle("chapter");

    const response = await this.apiClient.api.chapterControllerBetaCreateChapter({
      title,
      courseId: input.courseId,
      lessons: input.lessons,
      isFreemium: input.isFreemium,
    });

    return this.findChapterInCourse(input.courseId, response.data.data.id);
  }

  async getChapter(id: string, language: SupportedLanguages = "en") {
    const response = await this.apiClient.api.chapterControllerGetChapterWithLesson({
      id,
      language,
    });

    return response.data.data;
  }

  async updateChapter(id: string, data: UpdateChapterBody) {
    await this.apiClient.api.chapterControllerUpdateChapter(data, { id });
    return this.getChapter(id, data.language ?? "en");
  }

  async deleteChapter(id: string) {
    await this.apiClient.api.chapterControllerRemoveChapter({ chapterId: id });
  }

  async setChapterFreemium(id: string, isFreemium: boolean) {
    await this.apiClient.api.chapterControllerUpdateFreemiumStatus(
      { isFreemium },
      { chapterId: id },
    );
  }

  async updateChapterDisplayOrder(id: string, displayOrder: number) {
    await this.apiClient.api.chapterControllerUpdateChapterDisplayOrder({
      chapterId: id,
      displayOrder,
    });
  }

  async createContentLesson(
    courseId: string,
    input: CreateContentLessonInput,
  ): Promise<CurriculumCourseLessonRecord> {
    const title = input.title ?? createTitle("content-lesson");

    const response = await this.apiClient.api.lessonControllerBetaCreateLesson({
      title,
      chapterId: input.chapterId,
      type: "content",
      description: input.description ?? `<p>${TEST_DATA.course.descriptionPrefix} ${title}</p>`,
      displayOrder: input.displayOrder,
      contextId: input.contextId,
    });

    return this.findLessonInCourse(courseId, input.chapterId, response.data.data.id);
  }

  async updateContentLesson(lessonId: string, data: BetaUpdateLessonBody) {
    await this.apiClient.api.lessonControllerBetaUpdateLesson(data, { id: lessonId });
  }

  async createQuizLesson(
    courseId: string,
    input: CreateQuizLessonInput,
  ): Promise<CurriculumCourseLessonRecord> {
    const title = input.title ?? createTitle("quiz-lesson");

    const response = await this.apiClient.api.lessonControllerBetaCreateQuizLesson({
      title,
      chapterId: input.chapterId,
      type: "quiz",
      thresholdScore: input.thresholdScore ?? 50,
      attemptsLimit: input.attemptsLimit ?? null,
      quizCooldownInHours: input.quizCooldownInHours ?? null,
      questions: input.questions ?? [],
      displayOrder: input.displayOrder,
    });

    return this.findLessonInCourse(courseId, input.chapterId, response.data.data.id);
  }

  async updateQuizLesson(lessonId: string, data: BetaUpdateQuizLessonBody) {
    await this.apiClient.api.lessonControllerBetaUpdateQuizLesson(data, { id: lessonId });
  }

  async createEmbedLesson(
    courseId: string,
    input: CreateEmbedLessonBody,
  ): Promise<CurriculumCourseLessonRecord> {
    await this.apiClient.api.lessonControllerCreateEmbedLesson(input);

    return this.findLessonByTitle(courseId, input.chapterId, input.title);
  }

  async updateEmbedLesson(lessonId: string, data: UpdateEmbedLessonBody) {
    await this.apiClient.api.lessonControllerUpdateEmbedLesson(lessonId, data);
  }

  async createAiMentorLesson(
    courseId: string,
    input: CreateAiMentorLessonInput,
  ): Promise<CurriculumCourseLessonRecord> {
    const title = input.title ?? createTitle("ai-mentor-lesson");

    const response = await this.apiClient.api.lessonControllerBetaCreateAiMentorLesson({
      title,
      chapterId: input.chapterId,
      type: input.type ?? "mentor",
      name: input.name ?? "Mentor",
      description: input.description ?? "AI mentor lesson",
      aiMentorInstructions: input.aiMentorInstructions ?? "<p>Help the learner.</p>",
      completionConditions: input.completionConditions ?? "<p>Complete the conversation.</p>",
      voiceMode: input.voiceMode ?? "preset",
      ttsPreset: input.ttsPreset ?? "female",
      customTtsReference: input.customTtsReference ?? null,
      displayOrder: input.displayOrder,
    });

    return this.findLessonInCourse(courseId, input.chapterId, response.data.data.id);
  }

  async deleteLesson(id: string) {
    await this.apiClient.api.lessonControllerRemoveLesson({ lessonId: id });
  }

  async initializeLessonContext() {
    const response = await this.apiClient.api.lessonControllerInitializeLessonContext();

    return response.data.data.contextId;
  }

  private async findChapterInCourse(courseId: string, chapterId: string) {
    const course = await this.getCourse(courseId);
    const chapter = course.chapters.find((item) => item.id === chapterId);

    if (!chapter) {
      throw new Error(`Chapter ${chapterId} was not found in course ${courseId}`);
    }

    return chapter;
  }

  private async findLessonInCourse(courseId: string, chapterId: string, lessonId: string) {
    const chapter = await this.findChapterInCourse(courseId, chapterId);
    const lesson = (chapter.lessons ?? []).find((item) => item.id === lessonId);

    if (!lesson) {
      throw new Error(`Lesson ${lessonId} was not found in chapter ${chapterId}`);
    }

    return lesson;
  }

  private async findLessonByTitle(courseId: string, chapterId: string, title: string) {
    const chapter = await this.findChapterInCourse(courseId, chapterId);
    const lesson = (chapter.lessons ?? []).find((item) => item.title === title);

    if (!lesson) {
      throw new Error(`Lesson "${title}" was not found in chapter ${chapterId}`);
    }

    return lesson;
  }
}
