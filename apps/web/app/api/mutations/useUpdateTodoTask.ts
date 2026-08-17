import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import {
  optimisticallyUpdateTodoTask,
  todoTasksQueryKey,
  type TodoTask,
  type TodoTaskUpdateInput,
} from "../queries/useTodoTasks";
import { queryClient } from "../queryClient";

export function useUpdateTodoTask() {
  const { t } = useTranslation();
  const { toast } = useToast();

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
    onSuccess: () => {
      toast({ description: t("dashboardHome.widgets.todoTasks.toast.updateSuccess") });
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
          t("dashboardHome.widgets.todoTasks.toast.updateError"),
        ),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: todoTasksQueryKey }),
  });
}
