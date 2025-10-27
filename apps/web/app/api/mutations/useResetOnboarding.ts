import { useTour } from "@reactour/tour";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { currentUserQueryOptions } from "../queries";
import { queryClient } from "../queryClient";

export function useResetOnboarding() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { setIsOpen } = useTour();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.userControllerResetOnboardingStatus();

      return response.data;
    },
    onSuccess: () => {
      toast({
        description: t("resetOnboarding.toast.success"),
      });

      queryClient.invalidateQueries({ queryKey: currentUserQueryOptions.queryKey });
      setIsOpen(true);
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("resetOnboarding.toast.error"),
      });
    },
  });
}
