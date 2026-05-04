import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { currentUserQueryOptions } from "~/api/queries";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";

type CreateScormCourseBody = Parameters<typeof ApiClient.api.scormControllerCreateScormCourse>[0];

type CreateScormCourseOptions = {
  data: CreateScormCourseBody;
};

export function useCreateScormCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateScormCourseOptions) => {
      const response = await ApiClient.api.scormControllerCreateScormCourse(options.data);

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(currentUserQueryOptions);
      queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
      toast({ description: t(data.data.message) });
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
