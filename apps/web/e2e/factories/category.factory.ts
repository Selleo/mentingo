import { randomUUID } from "node:crypto";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  CreateCategoryBody,
  CreateCategoryResponse,
  GetCategoryByIdResponse,
  UpdateCategoryBody,
} from "~/api/generated-api";

export type CategoryFactoryCreateInput = Partial<CreateCategoryBody>;
export type CategoryFactoryCreateResult = CreateCategoryResponse["data"];
export type CategoryFactoryRecord = GetCategoryByIdResponse["data"];
export type CategoryFactoryUpdateInput = Omit<UpdateCategoryBody, "id">;

const createCategoryTitle = () => `E2E Category ${randomUUID().slice(0, 8)}`;

export class CategoryFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(overrides: CategoryFactoryCreateInput = {}): Promise<CategoryFactoryCreateResult> {
    const response = await this.apiClient.api.categoryControllerCreateCategory({
      title: overrides.title ?? createCategoryTitle(),
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
