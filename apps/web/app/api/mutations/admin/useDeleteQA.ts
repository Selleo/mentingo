import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { QA_QUERY_KEY } from "~/api/queries/useQA";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";

export default function useDeleteQA() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: string) => {
      const response = await ApiClient.api.qaControllerDeleteQa(options);

      return response.data;
    },
    onSuccess: async () => {
      toast({ description: t("qaView.toast.qaDeletedSuccessfully") });

      await queryClient.invalidateQueries({ queryKey: [QA_QUERY_KEY] });
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as { message: string };

      toast({
        description: t(apiResponseData.message),
        variant: "destructive",
      });
    },
  });
}
