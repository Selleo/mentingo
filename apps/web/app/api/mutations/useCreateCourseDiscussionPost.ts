import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import {
  getCourseDiscussionPostsQueryKey,
  type DiscussionFilter,
} from "~/api/queries/useCourseDiscussionPosts";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

type CreateCourseDiscussionPostBody = {
  type: "question" | "discussion" | "progress";
  content: string;
};

export function useCreateCourseDiscussionPost(courseId: string) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (body: CreateCourseDiscussionPostBody) => {
      const response = await ApiClient.instance.post(
        `/api/course/${courseId}/discussion/posts`,
        body,
      );
      return response.data;
    },
    onSuccess: () => {
      const filters: DiscussionFilter[] = ["all", "questions", "latest", "pinned"];

      filters.forEach((filter) => {
        queryClient.invalidateQueries({
          queryKey: getCourseDiscussionPostsQueryKey(courseId, filter),
        });
      });

      toast({ description: t("studentCourseView.discussion.postCreated") });
    },
    onError: () => {
      toast({ description: t("common.toast.somethingWentWrong"), variant: "destructive" });
    },
  });
}
