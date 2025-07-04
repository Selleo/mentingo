import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";
import { queryClient } from "../../queryClient";

import type { UpdateUserBody } from "../../generated-api";

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

      await queryClient.invalidateQueries({ queryKey: ["users"] });

      return response.data;
    },
    onSuccess: () => {
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
