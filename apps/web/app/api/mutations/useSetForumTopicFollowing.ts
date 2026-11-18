import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { forumTopicQueryOptions } from "~/api/queries/forum/useForumTopic";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useSetForumTopicFollowing() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ topicId, isFollowing }: { topicId: string; isFollowing: boolean }) => {
      const response = isFollowing
        ? await ApiClient.api.forumControllerFollowTopic(topicId)
        : await ApiClient.api.forumControllerUnfollowTopic(topicId);

      return response.data.data;
    },
    onSuccess: ({ topicId, isFollowing }) => {
      queryClient.invalidateQueries({ queryKey: forumTopicQueryOptions(topicId).queryKey });
      toast({
        description: isFollowing
          ? t("discussionNotifications.following.toast.followed")
          : t("discussionNotifications.following.toast.unfollowed"),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("discussionNotifications.following.toast.error"),
        ),
      });
    },
  });
}
