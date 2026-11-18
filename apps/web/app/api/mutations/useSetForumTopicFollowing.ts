import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { forumTopicQueryOptions } from "~/api/queries/forum/useForumTopic";
import { queryClient } from "~/api/queryClient";

import { useFollowingFeedback } from "./helpers/useFollowingFeedback";

export function useSetForumTopicFollowing() {
  const { showFollowingChanged, showFollowingError } = useFollowingFeedback();

  return useMutation({
    mutationFn: async ({ topicId, isFollowing }: { topicId: string; isFollowing: boolean }) => {
      const response = isFollowing
        ? await ApiClient.api.forumControllerFollowTopic(topicId)
        : await ApiClient.api.forumControllerUnfollowTopic(topicId);

      return response.data.data;
    },
    onSuccess: ({ topicId, isFollowing }) => {
      queryClient.invalidateQueries({ queryKey: forumTopicQueryOptions(topicId).queryKey });
      showFollowingChanged(isFollowing);
    },
    onError: showFollowingError,
  });
}
