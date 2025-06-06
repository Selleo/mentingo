import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

export function useBulkDeleteGroups() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (groupIds: string[]) => {
      const { data } = await ApiClient.api.groupControllerBulkDeleteGroups(groupIds);

      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });

      return data;
    },
    onSuccess: ({ data }) => {
      toast({ description: data.message });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
