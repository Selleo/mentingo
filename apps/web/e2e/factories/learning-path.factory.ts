import { randomUUID } from "node:crypto";

import { LEARNING_PATH_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  CreateLearningPathBody,
  GetLearningPathByIdResponse,
  GetLearningPathsResponse,
  UpdateLearningPathBody,
} from "~/api/generated-api";

export type LearningPathFactoryRecord = GetLearningPathByIdResponse["data"];
export type LearningPathFactoryListRecord = GetLearningPathsResponse["data"][number];
export type LearningPathFactoryCreateInput = Partial<CreateLearningPathBody>;

const createLearningPathTitle = () =>
  `${TEST_DATA.learningPath.titlePrefix} ${randomUUID().slice(0, 8)}`;

export class LearningPathFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input: LearningPathFactoryCreateInput = {}): Promise<LearningPathFactoryRecord> {
    const title = input.title ?? createLearningPathTitle();
    const response = await this.apiClient.api.learningPathControllerCreateLearningPath({
      language: SUPPORTED_LANGUAGES.EN,
      description: `${TEST_DATA.learningPath.descriptionPrefix} ${title}`,
      status: LEARNING_PATH_STATUSES.DRAFT,
      includesCertificate: false,
      sequenceEnabled: false,
      ...input,
      title,
    });

    return this.getById(response.data.data.id);
  }

  async createMany(
    count: number,
    build?: (index: number) => LearningPathFactoryCreateInput | undefined,
  ): Promise<LearningPathFactoryRecord[]> {
    const learningPaths: LearningPathFactoryRecord[] = [];

    for (let index = 0; index < count; index += 1) {
      learningPaths.push(await this.create(build?.(index)));
    }

    return learningPaths;
  }

  async getById(id: string): Promise<LearningPathFactoryRecord> {
    const response = await this.apiClient.api.learningPathControllerGetLearningPathById(id, {
      language: SUPPORTED_LANGUAGES.EN,
    });

    return response.data.data;
  }

  async search(searchQuery: string): Promise<LearningPathFactoryListRecord[]> {
    const response = await this.apiClient.api.learningPathControllerGetLearningPaths({
      searchQuery,
      page: 1,
      perPage: 100,
      language: SUPPORTED_LANGUAGES.EN,
    });

    return response.data.data;
  }

  async findByTitle(title: string): Promise<LearningPathFactoryListRecord | null> {
    const learningPaths = await this.search(title);

    return learningPaths.find((learningPath) => learningPath.title === title) ?? null;
  }

  async update(id: string, data: UpdateLearningPathBody): Promise<LearningPathFactoryRecord> {
    await this.apiClient.api.learningPathControllerUpdateLearningPath(id, {
      language: SUPPORTED_LANGUAGES.EN,
      ...data,
    });

    return this.getById(id);
  }

  async addCourses(id: string, courseIds: string[]): Promise<void> {
    await this.apiClient.api.learningPathCourseControllerAddCoursesToLearningPath(id, {
      courseIds,
    });
  }

  async enrollUsers(id: string, studentIds: string[]): Promise<void> {
    await this.apiClient.api.learningPathEnrollmentControllerEnrollUsersToLearningPath(id, {
      studentIds,
    });
  }

  async delete(id: string): Promise<void> {
    await this.apiClient.api.learningPathControllerDeleteLearningPath(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    await Promise.allSettled(ids.map((id) => this.delete(id)));
  }
}
