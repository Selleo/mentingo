import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

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
      const response = await ApiClient.api.userControllerBulkAssignUsersToGroup({
        userIds: options.data.userIds,
        groupId: options.data.groupId,
      });

      await queryClient.invalidateQueries({ queryKey: ["users"] });

      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("changeUserInformationView.toast.updatedSelectedUsersSuccessfully"),
      });
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
