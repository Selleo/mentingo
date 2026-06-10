import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_OWNERSHIP_CANDIDATES_QUERY_KEY } from "~/api/queries/admin/useCourseOwnershipCandidates";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLearningPathEnrollmentData } from "~/api/utils/invalidateLearningPathEnrollmentData";
import { useToast } from "~/components/ui/use-toast";

import type { CreateUserBody } from "~/api/generated-api";

type CreateUserOptions = {
  data: CreateUserBody;
};

export function useCreateUser() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateUserOptions) => {
      const response = await ApiClient.api.userControllerCreateUser(options.data);

      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({
        queryKey: [COURSE_OWNERSHIP_CANDIDATES_QUERY_KEY],
      });
      await queryClient.invalidateQueries(globalSettingsQueryOptions);
      await invalidateLearningPathEnrollmentData();

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("adminUserView.toast.userCreatedSuccessfully") });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
