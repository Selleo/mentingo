import { randomUUID } from "node:crypto";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  CreateLearningPathBody,
  GetLearningPathByIdResponse,
  GetLearningPathsResponse,
} from "~/api/generated-api";

export type LearningPathFactoryRecord = GetLearningPathByIdResponse["data"];
export type LearningPathFactoryCreateInput = Partial<CreateLearningPathBody>;
export type LearningPathFactoryUpdateInput = Partial<CreateLearningPathBody>;

const createLearningPathTitle = () =>
  `${TEST_DATA.learningPath.titlePrefix} ${randomUUID().slice(0, 8)}`;

export class LearningPathFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input: LearningPathFactoryCreateInput = {}): Promise<LearningPathFactoryRecord> {
    const title = input.title ?? createLearningPathTitle();
    const response = await this.apiClient.api.learningPathControllerCreateLearningPath({
      language: input.language ?? "en",
      title,
      description: input.description ?? `${TEST_DATA.learningPath.descriptionPrefix} ${title}`,
      status: input.status ?? "draft",
      ...(input.includesCertificate !== undefined && {
        includesCertificate: input.includesCertificate,
      }),
      ...(input.sequenceEnabled !== undefined && { sequenceEnabled: input.sequenceEnabled }),
      ...(input.settings !== undefined && { settings: input.settings }),
    });

    return this.getById(response.data.data.id, input.language ?? "en");
  }

  async getById(
    id: string,
    language: CreateLearningPathBody["language"] = "en",
  ): Promise<LearningPathFactoryRecord> {
    const response = await this.apiClient.api.learningPathControllerGetLearningPathById(id, {
      language,
    });

    return response.data.data;
  }

  async findByTitle(
    title: string,
    language: CreateLearningPathBody["language"] = "en",
  ): Promise<GetLearningPathsResponse["data"][number] | null> {
    const response = await this.apiClient.api.learningPathControllerGetLearningPaths({
      searchQuery: title,
      language,
      perPage: 100,
    });

    return response.data.data.find((learningPath) => learningPath.title === title) ?? null;
  }

  async update(
    id: string,
    data: LearningPathFactoryUpdateInput,
  ): Promise<LearningPathFactoryRecord> {
    await this.apiClient.api.learningPathControllerUpdateLearningPath(id, data);

    return this.getById(id, data.language ?? "en");
  }

  async addCourses(id: string, courseIds: string[]): Promise<void> {
    await this.apiClient.api.learningPathCourseControllerAddCoursesToLearningPath(id, {
      courseIds,
    });
  }

  async removeCourse(id: string, courseId: string): Promise<void> {
    await this.apiClient.api.learningPathCourseControllerRemoveCourseFromLearningPath(id, courseId);
  }

  async reorderCourses(id: string, courseIds: string[]): Promise<void> {
    await this.apiClient.api.learningPathCourseControllerReorderLearningPathCourses(id, {
      courseIds,
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.safeGetById(id);
    if (!existing) return;

    await this.apiClient.api.learningPathControllerDeleteLearningPath(id);
  }

  async safeGetById(id: string): Promise<LearningPathFactoryRecord | null> {
    try {
      return await this.getById(id);
    } catch {
      return null;
    }
  }
}
