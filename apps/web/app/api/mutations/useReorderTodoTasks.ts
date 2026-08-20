import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import {
  optimisticallyReorderTodoTasks,
  todoTasksQueryKey,
  type TodoTask,
  type TodoTaskOrderInput,
} from "../queries/useTodoTasks";
import { queryClient } from "../queryClient";

export function useReorderTodoTasks() {
  const { t } = useTranslation();
  const { toast } = useToast();

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
    onSuccess: () => {
      toast({ description: t("dashboardHome.widgets.todoTasks.toast.reorderSuccess") });
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(todoTasksQueryKey, context.previous);
      }
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("dashboardHome.widgets.todoTasks.toast.reorderError"),
        ),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: todoTasksQueryKey }),
  });
}
