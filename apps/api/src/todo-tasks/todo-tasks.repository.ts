import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { todoTasks } from "src/storage/schema";

import type { ReorderTodoTasksBody } from "./todo-tasks.types";
import type { UUIDType } from "src/common";

@Injectable()
export class TodoTasksRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findAll(userId: UUIDType) {
    return this.db
      .select()
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

  async create(userId: UUIDType, title: string) {
    const count = await this.count(userId);
    if (count >= 100) throw new BadRequestException("todoTasks.limitReached");
    const [{ activeCount }] = await this.db
      .select({ activeCount: sql<number>`COUNT(*)::INTEGER` })
      .from(todoTasks)
      .where(and(eq(todoTasks.userId, userId), isNull(todoTasks.completedAt)));
    const [task] = await this.db
      .insert(todoTasks)
      .values({ userId, title, position: activeCount })
      .returning();
    return task;
  }

  async update(userId: UUIDType, taskId: UUIDType, data: { title?: string; completed?: boolean }) {
    const [existing] = await this.db
      .select()
      .from(todoTasks)
      .where(and(eq(todoTasks.id, taskId), eq(todoTasks.userId, userId)));
    if (!existing) throw new NotFoundException("todoTasks.notFound");

    let completedAt = existing.completedAt;
    if (data.completed !== undefined)
      completedAt = data.completed ? new Date().toISOString() : null;
    const changedSection = (existing.completedAt === null) !== (completedAt === null);

    const result = await this.db.transaction(async (trx) => {
      let position = existing.position;
      if (changedSection) {
        const [{ count }] = await trx
          .select({ count: sql<number>`COUNT(*)::INTEGER` })
          .from(todoTasks)
          .where(
            and(
              eq(todoTasks.userId, userId),
              completedAt === null
                ? isNull(todoTasks.completedAt)
                : sql`${todoTasks.completedAt} IS NOT NULL`,
            ),
          );
        position = count;
      }
      const [task] = await trx
        .update(todoTasks)
        .set({
          title: data.title ?? existing.title,
          completedAt,
          position,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(todoTasks.id, taskId), eq(todoTasks.userId, userId)))
        .returning();
      return task;
    });
    if (changedSection) await this.compactPositions(userId);
    return result;
  }

  async remove(userId: UUIDType, taskId: UUIDType) {
    const deleted = await this.db
      .delete(todoTasks)
      .where(and(eq(todoTasks.id, taskId), eq(todoTasks.userId, userId)))
      .returning({ id: todoTasks.id });
    if (!deleted.length) throw new NotFoundException("todoTasks.notFound");
    await this.compactPositions(userId);
  }

  async reorder(userId: UUIDType, body: ReorderTodoTasksBody) {
    const ids = [...body.activeTaskIds, ...body.completedTaskIds];
    if (new Set(ids).size !== ids.length) throw new BadRequestException("todoTasks.invalidOrder");
    const owned = await this.db
      .select({ id: todoTasks.id, completedAt: todoTasks.completedAt })
      .from(todoTasks)
      .where(eq(todoTasks.userId, userId));
    const ownedById = new Map(owned.map((task) => [task.id, task]));
    const hasEveryTask =
      owned.length === ids.length && owned.every((task) => ids.includes(task.id));
    const activeSectionsAreStable = body.activeTaskIds.every(
      (id) => ownedById.get(id)?.completedAt === null,
    );
    const completedSectionsAreStable = body.completedTaskIds.every(
      (id) => ownedById.get(id)?.completedAt !== null,
    );
    if (!hasEveryTask || !activeSectionsAreStable || !completedSectionsAreStable) {
      throw new BadRequestException("todoTasks.invalidOrder");
    }

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

  private async compactPositions(userId: UUIDType) {
    const tasks = await this.db
      .select({ id: todoTasks.id, completedAt: todoTasks.completedAt })
      .from(todoTasks)
      .where(eq(todoTasks.userId, userId))
      .orderBy(
        asc(sql`CASE WHEN ${todoTasks.completedAt} IS NULL THEN 0 ELSE 1 END`),
        asc(todoTasks.position),
        asc(todoTasks.id),
      );
    const positions = new Map<string, number>();
    let activePosition = 0;
    let completedPosition = 0;
    for (const task of tasks) {
      if (task.completedAt === null) {
        positions.set(task.id, activePosition++);
      } else {
        positions.set(task.id, completedPosition++);
      }
    }
    await this.db.transaction(async (trx) => {
      for (const task of tasks) {
        await trx
          .update(todoTasks)
          .set({ position: positions.get(task.id)!, updatedAt: new Date().toISOString() })
          .where(and(eq(todoTasks.id, task.id), eq(todoTasks.userId, userId)));
      }
    });
  }
}
