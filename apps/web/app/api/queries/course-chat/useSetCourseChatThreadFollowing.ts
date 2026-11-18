import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { invalidateCourseChatMessages } from "./courseChatCache";

export function useSetCourseChatThreadFollowing(courseId: string) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ messageId, isFollowing }: { messageId: string; isFollowing: boolean }) => {
      const response = isFollowing
        ? await ApiClient.api.courseChatControllerFollowThread(messageId)
        : await ApiClient.api.courseChatControllerUnfollowThread(messageId);

      return response.data.data;
    },
    onSuccess: ({ isFollowing }) => {
      invalidateCourseChatMessages(courseId);
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
