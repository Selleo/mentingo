import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

type GroupBody = {
  name: string;
  description?: string;
};

export function useCreateGroup() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: GroupBody) => {
      const { data } = await ApiClient.api.groupControllerCreateGroup(input);

      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });

      return data;
    },

    onSuccess: ({ data }) => {
      toast({
        variant: "default",
        description: data.message,
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
