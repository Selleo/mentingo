import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getAdminRegistrationFormQueryKey } from "~/api/queries/admin/useAdminRegistrationForm";
import { REGISTRATION_FORM_QUERY_KEY } from "~/api/queries/useRegistrationForm";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { UpdateRegistrationFormBody } from "~/api/generated-api";
import type { ApiErrorResponse } from "~/api/types";

export function useUpdateRegistrationForm() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateRegistrationFormBody) => {
      const response = await ApiClient.api.settingsControllerUpdateRegistrationForm(data);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getAdminRegistrationFormQueryKey() });
      queryClient.invalidateQueries({ queryKey: [REGISTRATION_FORM_QUERY_KEY] });
      toast({ description: t("registrationFormBuilder.toast.saved") });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({
        variant: "destructive",
        description: t(message),
      });
    },
  });
}
