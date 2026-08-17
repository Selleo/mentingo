import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import {
  optimisticallyCreateTodoTask,
  todoTasksQueryKey,
  type TodoTask,
} from "../queries/useTodoTasks";
import { queryClient } from "../queryClient";

export function useCreateTodoTask() {
  return useMutation({
    mutationFn: async (title: string) => {
      return ApiClient.api.todoTasksControllerCreate({ title });
    },
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: todoTasksQueryKey });
      const previous = queryClient.getQueryData<TodoTask[]>(todoTasksQueryKey);

      if (previous) {
        queryClient.setQueryData(todoTasksQueryKey, optimisticallyCreateTodoTask(previous, title));
      }

      return { previous };
    },
    onError: (_error, _title, context) => {
      if (context?.previous) {
        queryClient.setQueryData(todoTasksQueryKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: todoTasksQueryKey }),
  });
}
