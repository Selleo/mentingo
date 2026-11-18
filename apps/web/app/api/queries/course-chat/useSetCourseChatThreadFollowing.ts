import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useFollowingFeedback } from "~/api/mutations/helpers/useFollowingFeedback";

import { invalidateCourseChatMessages } from "./courseChatCache";

export function useSetCourseChatThreadFollowing(courseId: string) {
  const { showFollowingChanged, showFollowingError } = useFollowingFeedback();

  return useMutation({
    mutationFn: async ({ messageId, isFollowing }: { messageId: string; isFollowing: boolean }) => {
      const response = isFollowing
        ? await ApiClient.api.courseChatControllerFollowThread(messageId)
        : await ApiClient.api.courseChatControllerUnfollowThread(messageId);

      return response.data.data;
    },
    onSuccess: ({ isFollowing }) => {
      invalidateCourseChatMessages(courseId);
      showFollowingChanged(isFollowing);
    },
    onError: showFollowingError,
  });
}
