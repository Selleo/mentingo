import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { DIRECTORY_SYNC_CONNECTION_QUERY_KEY } from "~/api/queries/admin/useDirectorySyncConnection";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { DirectorySyncProvider } from "@repo/shared";
import type {
  ReplaceDirectorySyncGroupMappingsBody,
  ReplaceDirectorySyncRoleMappingsBody,
} from "~/api/generated-api";

type SaveDirectorySyncGroupsVariables = {
  provider: DirectorySyncProvider;
  roleMappings: ReplaceDirectorySyncRoleMappingsBody;
  groupMappings: ReplaceDirectorySyncGroupMappingsBody;
};

/** Saves what each Google group means in Mentingo: its role and its synced Mentingo group. */
export function useSaveDirectorySyncGroups() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      provider,
      roleMappings,
      groupMappings,
    }: SaveDirectorySyncGroupsVariables) => {
      await ApiClient.api.directorySyncControllerReplaceDirectorySyncRoleMappings(
        provider,
        roleMappings,
      );
      const response = await ApiClient.api.directorySyncControllerReplaceDirectorySyncGroupMappings(
        provider,
        groupMappings,
      );

      return response.data.data;
    },
    onSuccess: () => {
      toast({ description: t("directorySync.toast.groupsSaved") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("directorySync.toast.groupsError")),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [DIRECTORY_SYNC_CONNECTION_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });
    },
  });
}
