import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export function useUnsubscribeFromDiscussionEmails() {
  return useMutation({
    mutationFn: async (token: string) => {
      const response = await ApiClient.api.discussionNotificationsControllerUnsubscribe({ token });

      return response.data.data;
    },
  });
}
