import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { usersQueryOptions } from "~/api/queries";
import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/admin/useUsersEnrolled";
import { invalidateCourseStatisticsQueries } from "~/api/utils/courseStatisticsUtils";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { UsersParams } from "~/api/queries/useUsers";

export const useImportUsers = (searchParams?: UsersParams) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData: {
        usersFile: File;
      } = { usersFile: file };

      const response = await ApiClient.api.userControllerImportUsers(formData);

      return response.data;
    },
    onSuccess: async ({ data }) => {
      const { importedUsersAmount, skippedUsersAmount } = data;

      toast({
        variant: "default",
        description: t("adminUsersView.import.toast.success", {
          importedUsersAmount,
          skippedUsersAmount,
        }),
      });

      await queryClient.invalidateQueries(usersQueryOptions(searchParams));
      await queryClient.invalidateQueries({ queryKey: [ENROLLED_USERS_QUERY_KEY] });

      await invalidateCourseStatisticsQueries();
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as { message: string };

      toast({
        variant: "destructive",
        description: t(apiResponseData?.message || error.message),
      });
    },
  });
};
