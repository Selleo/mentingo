import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { invalidateCourseStatisticsQueries } from "~/api/utils/courseStatisticsUtils";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";
import { queryClient } from "../../queryClient";

import type { BulkAssignUsersToGroupBody } from "../../generated-api";

type BulkAssignUsersToGroups = {
  data: BulkAssignUsersToGroupBody;
};

export function useBulkUpdateUsersGroups() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: BulkAssignUsersToGroups) => {
      const response = await ApiClient.api.userControllerBulkAssignUsersToGroup(options.data);

      return response.data;
    },
    onSuccess: async () => {
      toast({
        variant: "default",
        description: t("changeUserInformationView.toast.updatedSelectedUsersSuccessfully"),
      });

      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });

      await invalidateCourseStatisticsQueries();
    },

    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
