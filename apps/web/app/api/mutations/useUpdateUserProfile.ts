import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { currentUserQueryOptions } from "../queries/useCurrentUser";
import { queryClient } from "../queryClient";

import type { UpdateUserProfileBody } from "~/modules/Profile/types";

type UpdateUserProfileOptions = {
  data: UpdateUserProfileBody;
  id: string;
  file?: File;
};

export function useUpdateUserProfile() {
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (options: UpdateUserProfileOptions) => {
      const formData: {
        file?: File;
        data?: string;
      } = {};

      if (options.file) {
        formData.file = options.file;
      }

      if (options.data && Object.keys(options.data).length > 0) {
        const { file, ...updateData } = options.data;
        formData.data = JSON.stringify({
          ...updateData,
          ...(!options.file && file === null && { file: null }),
        });
      }

      const response = await ApiClient.api.userControllerUpdateUserProfile(formData);

      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(currentUserQueryOptions);
      queryClient.invalidateQueries({ queryKey: ["user-details", variables.id] });

      toast({ description: t("changeUserInformationView.toast.userDetailsUpdatedSuccessfully") });
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
