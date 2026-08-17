import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import {
  optimisticallyDeleteTodoTask,
  todoTasksQueryKey,
  type TodoTask,
} from "../queries/useTodoTasks";
import { queryClient } from "../queryClient";

export function useDeleteTodoTask() {
  return useMutation({
    mutationFn: async (id: string) => {
      return ApiClient.api.todoTasksControllerRemove(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: todoTasksQueryKey });
      const previous = queryClient.getQueryData<TodoTask[]>(todoTasksQueryKey);

      if (previous) {
        queryClient.setQueryData(todoTasksQueryKey, optimisticallyDeleteTodoTask(previous, id));
      }

      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(todoTasksQueryKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: todoTasksQueryKey }),
  });
}
