import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import {
  optimisticallyCreateTodoTask,
  todoTasksQueryKey,
  type TodoTask,
} from "../queries/useTodoTasks";
import { queryClient } from "../queryClient";

export function useCreateTodoTask() {
  const { t } = useTranslation();
  const { toast } = useToast();

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
    onSuccess: () => {
      toast({ description: t("dashboardHome.widgets.todoTasks.toast.createSuccess") });
    },
    onError: (error, _title, context) => {
      if (context?.previous) {
        queryClient.setQueryData(todoTasksQueryKey, context.previous);
      }
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("dashboardHome.widgets.todoTasks.toast.createError"),
        ),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: todoTasksQueryKey }),
  });
}
