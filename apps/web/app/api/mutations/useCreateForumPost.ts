import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import {
  invalidateCourseChatMessages,
  invalidateCourseChatReplies,
} from "~/api/queries/course-chat/courseChatCache";
import { FORUM_QUERY_KEY } from "~/api/queries/forum/forumQueryKeys";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

type CreateForumPostParams = {
  topicId: string;
  firstPostId: string;
  courseId: string | null;
};

export function useCreateForumPost({ topicId, firstPostId, courseId }: CreateForumPostParams) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (content: string) => {
      const response = await ApiClient.api.forumControllerCreatePost(topicId, { content });

      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FORUM_QUERY_KEY });

      if (courseId) {
        invalidateCourseChatMessages(courseId);
        invalidateCourseChatReplies(firstPostId);
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("forum.toast.createPostError")),
      });
    },
  });
}
