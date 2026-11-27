import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLearningPathEnrollmentData } from "~/api/utils/invalidateLearningPathEnrollmentData";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

export function useBulkDeleteGroups() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (groupIds: string[]) => {
      const { data } = await ApiClient.api.groupControllerBulkDeleteGroups(groupIds);

      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });
      await invalidateLearningPathEnrollmentData();

      return data;
    },
    onSuccess: ({ data }) => {
      toast({ description: data.message });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
