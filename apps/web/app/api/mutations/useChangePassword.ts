import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { passwordStatusQueryOptions } from "../queries";
import { useCurrentUserSuspense } from "../queries/useCurrentUser";
import { queryClient } from "../queryClient";

import type { ChangePasswordBody } from "../generated-api";
import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

type ChangePasswordOptions = {
  data: ChangePasswordBody;
  hasPassword: boolean;
};

export function useChangePassword() {
  const { data: currentUser } = useCurrentUserSuspense();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: ChangePasswordOptions) => {
      const response = await ApiClient.api.userControllerChangePassword(
        { id: currentUser.id },
        options.data,
      );

      return response.data;
    },
    onSuccess: async (_data, options) => {
      await queryClient.invalidateQueries(passwordStatusQueryOptions);

      toast({
        variant: "default",
        description: t(
          options.hasPassword
            ? "changePasswordView.toast.passwordChangedSuccessfully"
            : "changePasswordView.toast.passwordCreatedSuccessfully",
        ),
      });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
