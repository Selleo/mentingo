import { Injectable } from "@nestjs/common";

import { TodoTasksRepository } from "./todo-tasks.repository";

import type {
  CreateTodoTaskBody,
  ReorderTodoTasksBody,
  UpdateTodoTaskBody,
} from "./todo-tasks.types";
import type { UUIDType } from "src/common";

@Injectable()
export class TodoTasksService {
  constructor(private readonly repository: TodoTasksRepository) {}

  async list(userId: UUIDType) {
    return (await this.repository.findAll(userId)).map((task) => this.toResponse(task));
  }

  async create(userId: UUIDType, body: CreateTodoTaskBody) {
    return this.toResponse(await this.repository.create(userId, body.title.trim()));
  }

  async update(userId: UUIDType, taskId: UUIDType, body: UpdateTodoTaskBody) {
    return this.toResponse(
      await this.repository.update(userId, taskId, {
        ...(body.title === undefined ? {} : { title: body.title.trim() }),
        ...(body.completed === undefined ? {} : { completed: body.completed }),
      }),
    );
  }

  async remove(userId: UUIDType, taskId: UUIDType) {
    return this.repository.remove(userId, taskId);
  }

  async reorder(userId: UUIDType, body: ReorderTodoTasksBody) {
    return (await this.repository.reorder(userId, body)).map((task) => this.toResponse(task));
  }

  private toResponse(task: Awaited<ReturnType<TodoTasksRepository["findAll"]>>[number]) {
    return {
      id: task.id,
      title: task.title,
      completed: task.completedAt !== null,
      completedAt: task.completedAt,
      position: task.position,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
