import type { FixtureApiClient } from "../utils/api-client";
import type { CreateBody, ListResponse, ReorderBody, UpdateBody } from "~/api/generated-api";

export type TodoTaskFactoryRecord = ListResponse["data"][number];

export class TodoTaskFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async list(): Promise<TodoTaskFactoryRecord[]> {
    const response = await this.apiClient.api.todoTasksControllerList();
    return response.data.data;
  }

  async create(input: CreateBody): Promise<TodoTaskFactoryRecord> {
    const response = await this.apiClient.api.todoTasksControllerCreate(input);
    return response.data.data;
  }

  async update(id: string, input: UpdateBody): Promise<TodoTaskFactoryRecord> {
    const response = await this.apiClient.api.todoTasksControllerUpdate(id, input);
    return response.data.data;
  }

  async reorder(input: ReorderBody): Promise<TodoTaskFactoryRecord[]> {
    const response = await this.apiClient.api.todoTasksControllerReorder(input);
    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    await this.apiClient.api.todoTasksControllerRemove(id);
  }
}
