import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { todoTasks } from "src/storage/schema";

import type { ReorderTodoTasksBody } from "./todo-tasks.types";
import type { UUIDType } from "src/common";

const todoTaskResponseSelection = {
  id: todoTasks.id,
  title: todoTasks.title,
  completed: sql<boolean>`${todoTasks.completedAt} IS NOT NULL`,
  completedAt: todoTasks.completedAt,
  position: todoTasks.position,
  createdAt: todoTasks.createdAt,
  updatedAt: todoTasks.updatedAt,
};

@Injectable()
export class TodoTasksRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findAll(userId: UUIDType) {
    return this.db
      .select(todoTaskResponseSelection)
      .from(todoTasks)
      .where(eq(todoTasks.userId, userId))
      .orderBy(
        asc(sql`CASE WHEN ${todoTasks.completedAt} IS NULL THEN 0 ELSE 1 END`),
        asc(todoTasks.position),
      );
  }

  async count(userId: UUIDType) {
    const [result] = await this.db
      .select({ count: sql<number>`COUNT(*)::INTEGER` })
      .from(todoTasks)
      .where(eq(todoTasks.userId, userId));
    return result?.count ?? 0;
  }

  async countByCompletion(userId: UUIDType, completed: boolean) {
    const [result] = await this.db
      .select({ count: sql<number>`COUNT(*)::INTEGER` })
      .from(todoTasks)
      .where(
        and(
          eq(todoTasks.userId, userId),
          completed ? isNotNull(todoTasks.completedAt) : isNull(todoTasks.completedAt),
        ),
      );
    return result?.count ?? 0;
  }

  async create(userId: UUIDType, title: string, position: number) {
    const [task] = await this.db
      .insert(todoTasks)
      .values({ userId, title, position })
      .returning(todoTaskResponseSelection);
    return task;
  }

  async findById(userId: UUIDType, taskId: UUIDType) {
    const [task] = await this.db
      .select(todoTaskResponseSelection)
      .from(todoTasks)
      .where(and(eq(todoTasks.id, taskId), eq(todoTasks.userId, userId)));
    return task;
  }

  async update(
    userId: UUIDType,
    taskId: UUIDType,
    data: { title: string; completedAt: string | null; position: number },
  ) {
    const [task] = await this.db
      .update(todoTasks)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(todoTasks.id, taskId), eq(todoTasks.userId, userId)))
      .returning(todoTaskResponseSelection);
    return task;
  }

  async remove(userId: UUIDType, taskId: UUIDType) {
    const deleted = await this.db
      .delete(todoTasks)
      .where(and(eq(todoTasks.id, taskId), eq(todoTasks.userId, userId)))
      .returning({ id: todoTasks.id });
    return deleted.length > 0;
  }

  async reorder(userId: UUIDType, body: ReorderTodoTasksBody) {
    await this.db.transaction(async (trx) => {
      for (const [position, id] of body.activeTaskIds.entries()) {
        await trx
          .update(todoTasks)
          .set({ position, updatedAt: new Date().toISOString() })
          .where(and(eq(todoTasks.id, id), eq(todoTasks.userId, userId)));
      }
      for (const [offset, id] of body.completedTaskIds.entries()) {
        await trx
          .update(todoTasks)
          .set({ position: offset, updatedAt: new Date().toISOString() })
          .where(and(eq(todoTasks.id, id), eq(todoTasks.userId, userId)));
      }
    });
    return this.findAll(userId);
  }

  async compactPositions(userId: UUIDType) {
    const tasks = await this.db
      .select({ id: todoTasks.id, completedAt: todoTasks.completedAt })
      .from(todoTasks)
      .where(eq(todoTasks.userId, userId))
      .orderBy(
        asc(sql`CASE WHEN ${todoTasks.completedAt} IS NULL THEN 0 ELSE 1 END`),
        asc(todoTasks.position),
        asc(todoTasks.id),
      );
    let activePosition = 0;
    let completedPosition = 0;
    await this.db.transaction(async (trx) => {
      for (const task of tasks) {
        const position = task.completedAt === null ? activePosition++ : completedPosition++;
        await trx
          .update(todoTasks)
          .set({ position, updatedAt: new Date().toISOString() })
          .where(and(eq(todoTasks.id, task.id), eq(todoTasks.userId, userId)));
      }
    });
  }
}
