import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

export function useCopyContentMarketplaceListing() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (listingId: string) =>
      (await ApiClient.api.contentMarketplaceControllerCopyContentMarketplaceListing(listingId))
        .data.data,
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("contentMarketplace.copyFailed")),
        variant: "destructive",
      });
    },
  });
}
