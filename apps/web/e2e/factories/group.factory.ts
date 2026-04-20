import { randomUUID } from "node:crypto";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type { CreateGroupBody, GetGroupByIdResponse, UpdateGroupBody } from "~/api/generated-api";

export type GroupFactoryRecord = GetGroupByIdResponse["data"];
export type GroupFactoryCreateInput = Partial<CreateGroupBody>;
export type GroupFactoryUpdateInput = UpdateGroupBody;

const createGroupDefaults = (): CreateGroupBody => ({
  name: `${TEST_DATA.group.namePrefix} ${randomUUID().slice(0, 8)}`,
});

export class GroupFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input: GroupFactoryCreateInput = {}): Promise<GroupFactoryRecord> {
    const response = await this.apiClient.api.groupControllerCreateGroup({
      ...createGroupDefaults(),
      ...input,
    });

    return this.getById(response.data.data.id);
  }

  async createMany(
    count: number,
    build?: (index: number) => GroupFactoryCreateInput | undefined,
  ): Promise<GroupFactoryRecord[]> {
    return Promise.all(Array.from({ length: count }, (_, index) => this.create(build?.(index))));
  }

  async getById(id: string): Promise<GroupFactoryRecord> {
    const response = await this.apiClient.api.groupControllerGetGroupById(id);

    return response.data.data;
  }

  async findByName(name: string): Promise<GroupFactoryRecord | null> {
    const response = await this.apiClient.api.groupControllerGetAllGroups({
      keyword: name,
      page: 1,
      perPage: 100,
      sort: "name",
    });

    return response.data.data.find((group) => group.name === name) ?? null;
  }

  async update(id: string, data: GroupFactoryUpdateInput): Promise<GroupFactoryRecord> {
    await this.apiClient.api.groupControllerUpdateGroup(id, data);

    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    await this.apiClient.api.groupControllerDeleteGroup(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.apiClient.api.groupControllerBulkDeleteGroups(ids);
  }
}
