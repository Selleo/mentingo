import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { currentUserQueryOptions } from "~/api/queries";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";
import { invalidateCourseListData } from "../utils/invalidateCourseListData";

import type { CreateCourseBody } from "../generated-api";

type CreateCourseOptions = {
  data: CreateCourseBody;
};

export function useCreateCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateCourseOptions) => {
      const response = await ApiClient.api.courseControllerCreateCourse(options.data);

      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(currentUserQueryOptions),
        invalidateCourseListData(),
      ]);

      toast({ description: t("adminCourseView.toast.createCourseSuccessfully") });
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
