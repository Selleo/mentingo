import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { ListResponse } from "../generated-api";

export type TodoTask = ListResponse["data"][number];

export const todoTasksQueryKey = ["todo-tasks"] as const;

export type TodoTaskUpdateInput = {
  id: string;
  title?: string;
  completed?: boolean;
};

export type TodoTaskOrderInput = {
  activeTaskIds: string[];
  completedTaskIds: string[];
};

const withPositions = (tasks: TodoTask[]) => {
  let activePosition = 0;
  let completedPosition = 0;

  return tasks.map((task) => ({
    ...task,
    position: task.completed ? completedPosition++ : activePosition++,
  }));
};

export function optimisticallyCreateTodoTask(tasks: TodoTask[], title: string): TodoTask[] {
  const now = new Date().toISOString();
  const task: TodoTask = {
    id: `optimistic-${Date.now()}`,
    title,
    completed: false,
    completedAt: null,
    position: tasks.length,
    createdAt: now,
    updatedAt: now,
  };

  return withPositions([
    ...tasks.filter((item) => !item.completed),
    task,
    ...tasks.filter((item) => item.completed),
  ]);
}

export function optimisticallyUpdateTodoTask(
  tasks: TodoTask[],
  input: TodoTaskUpdateInput,
): TodoTask[] {
  const existing = tasks.find((task) => task.id === input.id);
  if (!existing) return tasks;

  const updated: TodoTask = {
    ...existing,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.completed === undefined
      ? {}
      : {
          completed: input.completed,
          completedAt: input.completed ? new Date().toISOString() : null,
        }),
    updatedAt: new Date().toISOString(),
  };
  const next = tasks.map((task) => (task.id === input.id ? updated : task));

  if (input.completed === undefined || input.completed === existing.completed) {
    return next;
  }

  const remaining = next.filter((task) => task.id !== input.id);
  const active = remaining.filter((task) => !task.completed);
  const completed = remaining.filter((task) => task.completed);
  return withPositions(
    input.completed ? [...active, ...completed, updated] : [...active, updated, ...completed],
  );
}

export function optimisticallyDeleteTodoTask(tasks: TodoTask[], id: string): TodoTask[] {
  return withPositions(tasks.filter((task) => task.id !== id));
}

export function optimisticallyReorderTodoTasks(
  tasks: TodoTask[],
  input: TodoTaskOrderInput,
): TodoTask[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const orderedIds = [...input.activeTaskIds, ...input.completedTaskIds];
  const remainingIds = tasks.map((task) => task.id).filter((id) => !orderedIds.includes(id));
  const ordered = [...orderedIds, ...remainingIds]
    .map((id) => byId.get(id))
    .filter((task): task is TodoTask => task !== undefined);

  return withPositions(ordered);
}

export function useTodoTasks(enabled = true) {
  return useQuery({
    queryKey: todoTasksQueryKey,
    enabled,
    queryFn: async () => {
      const response = await ApiClient.api.todoTasksControllerList();
      return response.data.data;
    },
  });
}
