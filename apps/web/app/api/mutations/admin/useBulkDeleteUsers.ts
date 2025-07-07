import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";
import { queryClient } from "../../queryClient";

import type { DeleteBulkUsersBody } from "../../generated-api";

type DeleteBulkUsers = {
  data: DeleteBulkUsersBody;
};

export function useBulkDeleteUsers() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: DeleteBulkUsers) => {
      const response = await ApiClient.api.userControllerDeleteBulkUsers({
        userIds: options.data.userIds,
      });

      await queryClient.invalidateQueries({ queryKey: ["users"] });

      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("changeUserInformationView.toast.deletedSelectedUsersSuccessfully"),
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
