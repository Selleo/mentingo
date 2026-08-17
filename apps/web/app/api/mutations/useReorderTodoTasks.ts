import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import {
  optimisticallyReorderTodoTasks,
  todoTasksQueryKey,
  type TodoTask,
  type TodoTaskOrderInput,
} from "../queries/useTodoTasks";
import { queryClient } from "../queryClient";

export function useReorderTodoTasks() {
  return useMutation({
    mutationFn: async (body: TodoTaskOrderInput) => {
      return ApiClient.api.todoTasksControllerReorder(body);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: todoTasksQueryKey });
      const previous = queryClient.getQueryData<TodoTask[]>(todoTasksQueryKey);

      if (previous) {
        queryClient.setQueryData(
          todoTasksQueryKey,
          optimisticallyReorderTodoTasks(previous, input),
        );
      }

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(todoTasksQueryKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: todoTasksQueryKey }),
  });
}
