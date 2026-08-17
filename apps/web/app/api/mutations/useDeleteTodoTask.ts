import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import {
  optimisticallyDeleteTodoTask,
  todoTasksQueryKey,
  type TodoTask,
} from "../queries/useTodoTasks";
import { queryClient } from "../queryClient";

export function useDeleteTodoTask() {
  const { t } = useTranslation();
  const { toast } = useToast();

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
    onSuccess: () => {
      toast({ description: t("dashboardHome.widgets.todoTasks.toast.deleteSuccess") });
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(todoTasksQueryKey, context.previous);
      }
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("dashboardHome.widgets.todoTasks.toast.deleteError"),
        ),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: todoTasksQueryKey }),
  });
}
