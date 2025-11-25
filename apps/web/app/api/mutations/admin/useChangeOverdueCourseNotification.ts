import { useMutation } from "@tanstack/react-query";

import { userSettingsQueryOptions } from "~/api/queries/useUserSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

export function useChangeOverdueCourseNotification() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      //   const response = await ApiClient.api.settingsControllerUpdateAdminOverdueCourseNotification();
      const response = { data: true };
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(userSettingsQueryOptions);
      toast({
        variant: "default",
        description: "Overdue course notifications preference changed successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Failed to change overdue course notifications preference",
      });
    },
  });
}
