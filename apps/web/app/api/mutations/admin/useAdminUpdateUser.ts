import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_OWNERSHIP_CANDIDATES_QUERY_KEY } from "~/api/queries/admin/useCourseOwnershipCandidates";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { invalidateCourseStatisticsQueries } from "~/api/utils/courseStatisticsUtils";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";
import { queryClient } from "../../queryClient";

import type { UpdateUserBody } from "../../generated-api";
import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

type UpdateUserOptions = {
  data: UpdateUserBody;
  userId: string;
};

export function useAdminUpdateUser() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateUserOptions) => {
      const response = await ApiClient.api.userControllerAdminUpdateUser(
        { id: options.userId },
        options.data,
      );

      return response.data;
    },
    onSuccess: async () => {
      toast({ description: t("changeUserInformationView.toast.userUpdatedSuccessfully") });

      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });
      await queryClient.invalidateQueries({
        queryKey: [COURSE_OWNERSHIP_CANDIDATES_QUERY_KEY],
      });

      await invalidateCourseStatisticsQueries();
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({
        description: message ? t(message) : t("common.toast.somethingWentWrong"),
        variant: "destructive",
      });
    },
  });
}
