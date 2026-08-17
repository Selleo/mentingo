import type {
  createTodoTaskSchema,
  reorderTodoTasksSchema,
  todoTaskSchema,
  updateTodoTaskSchema,
} from "./todo-tasks.schema";
import type { Static } from "@sinclair/typebox";

export type TodoTaskResponse = Static<typeof todoTaskSchema>;
export type CreateTodoTaskBody = Static<typeof createTodoTaskSchema>;
export type UpdateTodoTaskBody = Static<typeof updateTodoTaskSchema>;
export type ReorderTodoTasksBody = Static<typeof reorderTodoTasksSchema>;
