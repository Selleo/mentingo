import { useNavigate } from "@remix-run/react";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import type { RegisterBody } from "../generated-api";
import type { ApiErrorResponse } from "../types";

type RegisterPayload = RegisterBody & {
  formAnswers?: Record<string, boolean>;
};

type RegisterUserOptions = {
  data: RegisterPayload;
};

export function useRegisterUser() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: RegisterUserOptions) => {
      const response = await ApiClient.api.authControllerRegister(options.data);

      return response.data;
    },
    onSuccess: () => {
      navigate("/auth/login");
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        const { message } = error.response?.data as ApiErrorResponse;

        return toast({
          variant: "destructive",
          description: message ? t(message) : t("common.toast.somethingWentWrong"),
        });
      }

      toast({
        variant: "destructive",
        description: t("common.toast.somethingWentWrong"),
      });
    },
  });
}
