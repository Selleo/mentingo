import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

type DeleteDocumentLinkOptions = {
  documentLinkId: string;
};

export function useDeleteDocumentLink() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: DeleteDocumentLinkOptions) => {
      const response = await ApiClient.api.ingestionControllerDeleteDocumentLink(
        options.documentLinkId,
      );

      return response.data;
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
    onSuccess: () => {
      return toast({
        description: t(
          "adminCourseView.curriculum.lesson.toast.aiMentorLessonFileDeletedSuccessfully",
        ),
        variant: "default",
      });
    },
  });
}
