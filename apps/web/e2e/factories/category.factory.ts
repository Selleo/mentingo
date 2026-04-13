import { randomUUID } from "node:crypto";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  CreateCategoryResponse,
  GetCategoryByIdResponse,
  UpdateCategoryBody,
} from "~/api/generated-api";

export type CategoryFactoryCreateResult = CreateCategoryResponse["data"];
export type CategoryFactoryRecord = GetCategoryByIdResponse["data"];
export type CategoryFactoryUpdateInput = Omit<UpdateCategoryBody, "id">;

const createCategoryTitle = () => {
  return `${TEST_DATA.category.titlePrefix} ${randomUUID().slice(0, 8)}`;
};

export class CategoryFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(title?: string): Promise<CategoryFactoryCreateResult> {
    const response = await this.apiClient.api.categoryControllerCreateCategory({
      title: title ?? createCategoryTitle(),
    });

    return response.data.data;
  }

  async getById(id: string): Promise<CategoryFactoryRecord> {
    const response = await this.apiClient.api.categoryControllerGetCategoryById(id);

    return response.data.data;
  }

  async update(id: string, data: CategoryFactoryUpdateInput): Promise<CategoryFactoryRecord> {
    const response = await this.apiClient.api.categoryControllerUpdateCategory(id, data);

    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    await this.apiClient.api.categoryControllerDeleteCategory(id);
  }
}
