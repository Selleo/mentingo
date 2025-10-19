import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { usersQueryOptions } from "~/api/queries";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";
import { queryClient } from "../../queryClient";

import type { ArchiveBulkUsersBody } from "../../generated-api";
import type { UsersParams } from "~/api/queries/useUsers";

type BulkArchiveUsersOptions = {
  data: ArchiveBulkUsersBody;
  searchParams?: UsersParams;
};

export function useBulkArchiveUsers() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: BulkArchiveUsersOptions) => {
      const response = await ApiClient.api.userControllerArchiveBulkUsers({
        userIds: options.data.userIds,
      });

      return response.data;
    },
    onSuccess: async (_, variables) => {
      toast({
        variant: "default",
        description: t("changeUserInformationView.toast.archivedSelectedUsersSuccessfully"),
      });

      await queryClient.invalidateQueries(usersQueryOptions(variables.searchParams));
      await queryClient.invalidateQueries({ queryKey: ["users", "admin"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("changeUserInformationView.toast.archiveSelectedUsersError"),
      });
    },
  });
}
