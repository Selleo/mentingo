import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import {
  getCourseDiscussionPostsQueryKey,
  type DiscussionFilter,
} from "~/api/queries/useCourseDiscussionPosts";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

type SetCourseDiscussionPostPinStateBody = {
  isPinned: boolean;
};

export function useSetCourseDiscussionPostPinState(courseId: string) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      postId,
      isPinned,
    }: SetCourseDiscussionPostPinStateBody & { postId: string }) => {
      const response = await ApiClient.instance.patch(
        `/api/course/${courseId}/discussion/posts/${postId}/pin`,
        { isPinned },
      );

      return response.data;
    },
    onSuccess: (_data, variables) => {
      const filters: DiscussionFilter[] = ["all", "questions", "latest", "pinned"];

      filters.forEach((filter) => {
        queryClient.invalidateQueries({
          queryKey: getCourseDiscussionPostsQueryKey(courseId, filter),
        });
      });

      toast({
        description: variables.isPinned
          ? t("studentCourseView.discussion.post.pinnedUpdated")
          : t("studentCourseView.discussion.post.unpinnedUpdated"),
      });
    },
    onError: () => {
      toast({ description: t("common.toast.somethingWentWrong"), variant: "destructive" });
    },
  });
}
