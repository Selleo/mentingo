import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

export function useExecuteCompetenciesCommand() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (
      body: Parameters<typeof ApiClient.api.competenciesControllerExecuteCompetenciesCommand>[0],
    ) => (await ApiClient.api.competenciesControllerExecuteCompetenciesCommand(body)).data.data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["competencies", "workspace"] });
      await queryClient.invalidateQueries({ queryKey: ["competencies", "records"] });
      toast({ description: t("competencies.saved") });
    },
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("competencies.serviceError")),
      }),
  });
}
