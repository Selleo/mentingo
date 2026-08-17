import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import {
  optimisticallyUpdateTodoTask,
  todoTasksQueryKey,
  type TodoTask,
  type TodoTaskUpdateInput,
} from "../queries/useTodoTasks";
import { queryClient } from "../queryClient";

export function useUpdateTodoTask() {
  return useMutation({
    mutationFn: async ({ id, ...body }: TodoTaskUpdateInput) => {
      return ApiClient.api.todoTasksControllerUpdate(id, body);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: todoTasksQueryKey });
      const previous = queryClient.getQueryData<TodoTask[]>(todoTasksQueryKey);

      if (previous) {
        queryClient.setQueryData(todoTasksQueryKey, optimisticallyUpdateTodoTask(previous, input));
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
