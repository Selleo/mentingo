import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import {
  getCourseDiscussionCommentsQueryKey,
  type CourseDiscussionComment,
} from "~/api/queries/useCourseDiscussionComments";
import {
  getCourseDiscussionPostsQueryKey,
  type DiscussionFilter,
} from "~/api/queries/useCourseDiscussionPosts";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

type CreateCourseDiscussionCommentBody = {
  content: string;
  parentCommentId?: string;
};

export function useCreateCourseDiscussionComment(courseId: string, postId: string) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (body: CreateCourseDiscussionCommentBody) => {
      const response = await ApiClient.instance.post<{ data: CourseDiscussionComment }>(
        `/api/course/${courseId}/discussion/posts/${postId}/comments`,
        body,
      );

      return response.data.data;
    },
    onSuccess: () => {
      const filters: DiscussionFilter[] = ["all", "questions", "latest", "pinned"];

      filters.forEach((filter) => {
        queryClient.invalidateQueries({
          queryKey: getCourseDiscussionPostsQueryKey(courseId, filter),
        });
      });

      queryClient.invalidateQueries({
        queryKey: getCourseDiscussionCommentsQueryKey(courseId, postId),
      });

      toast({ description: t("studentCourseView.discussion.commentCreated") });
    },
    onError: () => {
      toast({ description: t("common.toast.somethingWentWrong"), variant: "destructive" });
    },
  });
}
