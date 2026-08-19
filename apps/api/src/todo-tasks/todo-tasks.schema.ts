import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const todoTaskSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String({ minLength: 1, maxLength: 200 }),
  completed: Type.Boolean(),
  completedAt: Type.Union([Type.String(), Type.Null()]),
  position: Type.Number(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const todoTaskListSchema = Type.Array(todoTaskSchema);

export const createTodoTaskSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
});

export const updateTodoTaskSchema = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  completed: Type.Optional(Type.Boolean()),
});

export const reorderTodoTasksSchema = Type.Object({
  activeTaskIds: Type.Array(UUIDSchema, { maxItems: 100 }),
  completedTaskIds: Type.Array(UUIDSchema, { maxItems: 100 }),
});
