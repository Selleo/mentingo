import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getCourseDiscussionCommentsQueryKey } from "~/api/queries/useCourseDiscussionComments";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { CourseDiscussionComment } from "~/api/queries/useCourseDiscussionComments";

export function useMarkCourseDiscussionCommentHelpful(courseId: string, postId: string) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const response = await ApiClient.instance.patch<{ data: CourseDiscussionComment }>(
        `/api/course/${courseId}/discussion/posts/${postId}/comments/${commentId}/helpful`,
      );

      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getCourseDiscussionCommentsQueryKey(courseId, postId),
      });

      toast({ description: t("studentCourseView.discussion.helpfulUpdated") });
    },
    onError: () => {
      toast({ description: t("common.toast.somethingWentWrong"), variant: "destructive" });
    },
  });
}
