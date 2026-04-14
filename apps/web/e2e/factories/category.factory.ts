import { randomUUID } from "node:crypto";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  CreateCategoryBody,
  GetCategoryByIdResponse,
  UpdateCategoryBody,
} from "~/api/generated-api";

export type CategoryFactoryRecord = GetCategoryByIdResponse["data"];
export type CategoryFactoryCreateResult = CategoryFactoryRecord;
export type CategoryFactoryUpdateInput = Omit<UpdateCategoryBody, "id">;

const createCategoryTitle = () => {
  return `${TEST_DATA.category.titlePrefix} ${randomUUID().slice(0, 8)}`;
};

export class CategoryFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input?: string | CreateCategoryBody): Promise<CategoryFactoryCreateResult> {
    const response = await this.apiClient.api.categoryControllerCreateCategory({
      title: typeof input === "string" ? input : (input?.title ?? createCategoryTitle()),
    });

    return this.getById(response.data.data.id);
  }

  async createMany(
    count: number,
    build?: (index: number) => string | CreateCategoryBody | undefined,
  ): Promise<CategoryFactoryCreateResult[]> {
    return Promise.all(Array.from({ length: count }, (_, index) => this.create(build?.(index))));
  }

  async getById(id: string): Promise<CategoryFactoryRecord> {
    const response = await this.apiClient.api.categoryControllerGetCategoryById(id);

    return response.data.data;
  }

  async findByTitle(title: string): Promise<CategoryFactoryRecord | null> {
    const response = await this.apiClient.api.categoryControllerGetAllCategories({
      title,
      page: 1,
      perPage: 100,
    });

    return response.data.data.find((category) => category.title === title) ?? null;
  }

  async update(id: string, data: CategoryFactoryUpdateInput): Promise<CategoryFactoryRecord> {
    const response = await this.apiClient.api.categoryControllerUpdateCategory(id, data);

    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    await this.apiClient.api.categoryControllerDeleteCategory(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.apiClient.api.categoryControllerDeleteManyCategories(ids);
  }
}
