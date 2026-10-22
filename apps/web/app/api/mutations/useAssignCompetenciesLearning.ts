import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

export function useAssignCompetenciesLearning() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (
      body: Parameters<typeof ApiClient.api.competenciesControllerAssignCompetenciesLearning>[0],
    ) => (await ApiClient.api.competenciesControllerAssignCompetenciesLearning(body)).data.data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["competencies", "workspace"] });
      await queryClient.invalidateQueries({ queryKey: ["competencies", "records"] });
    },
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("competencies.serviceError")),
      }),
  });
}
