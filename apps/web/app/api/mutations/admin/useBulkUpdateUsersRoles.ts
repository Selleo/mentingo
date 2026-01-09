import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";
import { queryClient } from "../../queryClient";

import type { BulkUpdateUsersRolesBody } from "../../generated-api";
import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

export function useBulkUpdateUsersRoles() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: BulkUpdateUsersRolesBody) => {
      const response = await ApiClient.api.userControllerBulkUpdateUsersRoles(options);

      return response.data;
    },
    onSuccess: async () => {
      toast({
        variant: "default",
        description: t("changeUserInformationView.toast.updatedSelectedUsersSuccessfully"),
      });

      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },

    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
