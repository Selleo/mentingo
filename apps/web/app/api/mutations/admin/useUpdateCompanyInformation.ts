import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { companyInformationQueryOptions } from "~/api/queries/useCompanyInformation";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateCompanyInformationBody } from "~/api/generated-api";

export function useUpdateCompanyInformation() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: UpdateCompanyInformationBody) => {
      const response = await ApiClient.api.settingsControllerUpdateCompanyInformation(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(companyInformationQueryOptions);
      toast({
        description: t("providerInformation.updateSuccess"),
      });
    },
    onError: () => {
      toast({
        description: t("providerInformation.updateError"),
        variant: "destructive",
      });
    },
  });
}
