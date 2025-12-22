import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { currentUserQueryOptions, useCurrentUserSuspense } from "~/api/queries";
import { COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY } from "~/api/queries/admin/useCourseLearningTimeStatisticsFilterOptions";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";

import type { UpdateUserBody } from "../generated-api";

type UpdateUserOptions = {
  data: UpdateUserBody;
};

export function useUpdateUser() {
  const { data: currentUser } = useCurrentUserSuspense();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateUserOptions) => {
      const response = await ApiClient.api.userControllerUpdateUser(
        {
          id: currentUser.id,
        },
        options.data,
      );

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(currentUserQueryOptions);
      await queryClient.invalidateQueries({
        queryKey: [COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY],
      });

      toast({ description: t("changeUserInformationView.toast.userUpdatedSuccessfully") });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
