import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
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

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("adminUserView.toast.userCreatedSuccessfully") });
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
