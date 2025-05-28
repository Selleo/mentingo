import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

type BulkCourseEnroll = {
  data: Array<string>;
};

export function useBulkCourseEnroll() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ data }: BulkCourseEnroll) => {
      // TODO: call an api here to bulk enroll students
      return { data };
    },

    onSuccess: ({ data }) => {
      toast({
        variant: "default",
        description: `${data.length} ${t("adminCourseView.enrolled.successResponse")}`,
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
