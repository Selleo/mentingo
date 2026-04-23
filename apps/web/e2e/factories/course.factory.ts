import { randomUUID } from "node:crypto";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  CreateCourseBody,
  GetAllCoursesResponse,
  GetBetaCourseByIdResponse,
  UpdateCourseBody,
  UpdateCourseSettingsBody,
} from "~/api/generated-api";

export type CourseFactoryListRecord = GetAllCoursesResponse["data"][number];
export type CourseFactoryRecord = GetBetaCourseByIdResponse["data"];
export type CourseFactoryCreateInput = Partial<CreateCourseBody> & {
  categoryId: string;
};
export type CourseFactoryUpdateInput = UpdateCourseBody;

const createCourseTitle = () => `${TEST_DATA.course.titlePrefix} ${randomUUID().slice(0, 8)}`;

export class CourseFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input: CourseFactoryCreateInput): Promise<CourseFactoryRecord> {
    const title = input.title ?? createCourseTitle();
    const response = await this.apiClient.api.courseControllerCreateCourse({
      title,
      description: input.description ?? `${TEST_DATA.course.descriptionPrefix} ${title}`,
      categoryId: input.categoryId,
      language: input.language ?? "en",
      status: input.status ?? "draft",
      thumbnailS3Key: input.thumbnailS3Key,
      priceInCents: input.priceInCents,
      currency: input.currency,
      isScorm: input.isScorm,
      hasCertificate: input.hasCertificate,
      chapters: input.chapters,
    });

    return this.getById(response.data.data.id, input.language ?? "en");
  }

  async createMany(
    count: number,
    build: (index: number) => CourseFactoryCreateInput,
  ): Promise<CourseFactoryRecord[]> {
    return Promise.all(Array.from({ length: count }, (_, index) => this.create(build(index))));
  }

  async getById(id: string, language: CreateCourseBody["language"] = "en") {
    const response = await this.apiClient.api.courseControllerGetBetaCourseById({ id, language });

    return response.data.data;
  }

  async findByTitle(title: string, language: CreateCourseBody["language"] = "en") {
    const response = await this.apiClient.api.courseControllerGetAllCourses({
      title,
      language,
      perPage: 100,
    });

    return response.data.data.find((course) => course.title === title) ?? null;
  }

  async update(id: string, data: CourseFactoryUpdateInput) {
    await this.apiClient.api.courseControllerUpdateCourse(id, data);
    return this.getById(id, data.language ?? "en");
  }

  async updateSettings(id: string, data: UpdateCourseSettingsBody) {
    await this.apiClient.api.courseControllerUpdateCourseSettings(id, data);
  }

  async getSettings(id: string) {
    const response = await this.apiClient.api.courseControllerGetCourseSettings(id);

    return response.data.data;
  }

  async updateHasCertificate(id: string, hasCertificate: boolean) {
    await this.apiClient.api.courseControllerUpdateHasCertificate(id, { hasCertificate });
    return this.getById(id);
  }

  async setStudentMode(id: string, enabled: boolean) {
    const response = await this.apiClient.api.courseControllerSetCourseStudentMode(id, {
      enabled,
    });

    return response.data.data;
  }

  async getCurrentUserStudentModeCourseIds() {
    const response = await this.apiClient.api.authControllerCurrentUser();

    return response.data.data.studentModeCourseIds;
  }

  async getOwnership(id: string) {
    const response = await this.apiClient.api.courseControllerGetCourseOwnership(id);

    return response.data.data;
  }

  async transferOwnership(id: string, userId: string) {
    await this.apiClient.api.courseControllerTransferCourseOwnership({
      courseId: id,
      userId,
    });

    return this.getOwnership(id);
  }

  async createLanguage(id: string, language: CreateCourseBody["language"]) {
    await this.apiClient.api.courseControllerCreateLanguage(id, { language });
    return this.getById(id, language);
  }

  async deleteLanguage(id: string, language: CreateCourseBody["language"]) {
    await this.apiClient.api.courseControllerDeleteLanguage(id, { language });
  }

  async delete(id: string) {
    const existingCourse = await this.safeGetById(id);
    if (!existingCourse) return;

    await this.apiClient.api.courseControllerDeleteCourse(id);
  }

  async deleteMany(ids: string[]) {
    if (ids.length === 0) return;

    const existingCourses = await Promise.all(ids.map((id) => this.safeGetById(id)));
    const existingIds = existingCourses
      .filter((course): course is CourseFactoryRecord => Boolean(course))
      .map((course) => course.id);

    if (existingIds.length === 0) return;

    await this.apiClient.api.courseControllerDeleteManyCourses({ ids: existingIds });
  }

  private async safeGetById(id: string): Promise<CourseFactoryRecord | null> {
    try {
      return await this.getById(id);
    } catch {
      return null;
    }
  }
}
