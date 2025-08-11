import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

type GroupBody = {
  name: string;
  description?: string;
};

export function useUpdateGroup(groupId: string) {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: GroupBody) => {
      const { data } = await ApiClient.api.groupControllerUpdateGroup(groupId, input);

      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["users"] });

      return data;
    },

    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminGroupsView.updateGroup.groupUpdatedSuccessfully"),
      });
    },

    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
