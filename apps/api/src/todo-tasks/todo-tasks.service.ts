import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { TodoTasksRepository } from "./todo-tasks.repository";

import type {
  CreateTodoTaskBody,
  ReorderTodoTasksBody,
  UpdateTodoTaskBody,
} from "./todo-tasks.types";
import type { UUIDType } from "src/common";

@Injectable()
export class TodoTasksService {
  constructor(private readonly todoTasksRepository: TodoTasksRepository) {}

  async list(userId: UUIDType) {
    return this.todoTasksRepository.findAll(userId);
  }

  async create(userId: UUIDType, body: CreateTodoTaskBody) {
    const taskCount = await this.todoTasksRepository.count(userId);
    if (taskCount >= 100) {
      throw new BadRequestException("todoTasks.limitReached");
    }

    const activeTaskCount = await this.todoTasksRepository.countByCompletion(userId, false);
    return this.todoTasksRepository.create(userId, body.title.trim(), activeTaskCount);
  }

  async update(userId: UUIDType, taskId: UUIDType, body: UpdateTodoTaskBody) {
    const existingTask = await this.todoTasksRepository.findById(userId, taskId);
    if (!existingTask) {
      throw new NotFoundException("todoTasks.notFound");
    }

    let completedAt = existingTask.completedAt;
    if (body.completed !== undefined) {
      completedAt = body.completed ? new Date().toISOString() : null;
    }
    const changedSection = existingTask.completed !== (completedAt !== null);
    const position = changedSection
      ? await this.todoTasksRepository.countByCompletion(userId, completedAt !== null)
      : existingTask.position;
    const task = await this.todoTasksRepository.update(userId, taskId, {
      title: body.title?.trim() ?? existingTask.title,
      completedAt,
      position,
    });
    if (!task) {
      throw new NotFoundException("todoTasks.notFound");
    }
    if (changedSection) {
      await this.todoTasksRepository.compactPositions(userId);
    }
    return task;
  }

  async remove(userId: UUIDType, taskId: UUIDType) {
    const removed = await this.todoTasksRepository.remove(userId, taskId);
    if (!removed) {
      throw new NotFoundException("todoTasks.notFound");
    }
    await this.todoTasksRepository.compactPositions(userId);
  }

  async reorder(userId: UUIDType, body: ReorderTodoTasksBody) {
    const taskIds = [...body.activeTaskIds, ...body.completedTaskIds];
    const tasks = await this.todoTasksRepository.findAll(userId);
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const hasDuplicateIds = new Set(taskIds).size !== taskIds.length;
    const hasEveryTask =
      tasks.length === taskIds.length && tasks.every((task) => taskIds.includes(task.id));
    const activeSectionsAreStable = body.activeTaskIds.every(
      (id) => tasksById.get(id)?.completed === false,
    );
    const completedSectionsAreStable = body.completedTaskIds.every(
      (id) => tasksById.get(id)?.completed === true,
    );

    if (
      hasDuplicateIds ||
      !hasEveryTask ||
      !activeSectionsAreStable ||
      !completedSectionsAreStable
    ) {
      throw new BadRequestException("todoTasks.invalidOrder");
    }

    return this.todoTasksRepository.reorder(userId, body);
  }
}
