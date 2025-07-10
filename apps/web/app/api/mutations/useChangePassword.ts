import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { useCurrentUserSuspense } from "../queries/useCurrentUser";

import type { ChangePasswordBody } from "../generated-api";

interface PasswordValidationError {
  type: number;
  schema?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    errorMessage?: string;
    type?: string;
    allOf?: unknown[];
  };
  path: string;
  value: unknown;
  message: string;
}

type ChangePasswordOptions = {
  data: ChangePasswordBody;
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
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("changePasswordView.toast.passwordChangedSuccessfully"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        const errors = error.response?.data.errors || [];
        const errorMessages: string[] = [];

        errors.forEach((err: PasswordValidationError) => {
          if (err.schema?.errorMessage) {
            errorMessages.push(err.schema.errorMessage);
          }
        });

        const uniqueMessages = [...new Set(errorMessages)];
        const errorString = uniqueMessages.join("\n");

        return toast({
          variant: "destructive",
          description: errorString || error.response?.data.message,
        });
      }

      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
