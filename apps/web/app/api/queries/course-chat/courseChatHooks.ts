import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import {
  invalidateCourseChatMessageCreated,
  updateDeletedMessageInCache,
  updateMessageReactionsInCache,
} from "./courseChatCache";
import { getInfiniteCourseChatRepliesQueryKey } from "./courseChatQueryKeys";
import {
  courseChatMessagesQueryOptions,
  courseChatUsersQueryOptions,
  COURSE_CHAT_REPLIES_PER_PAGE,
  courseChatRepliesQueryOptions,
} from "./courseChatQueryOptions";

import type { InfiniteData } from "@tanstack/react-query";
import type {
  CreateMessageBody,
  GetRepliesResponse,
  ToggleMessageReactionBody,
} from "~/api/generated-api";

export function useCourseChatMessages(courseId: string, page = 1) {
  return useQuery(courseChatMessagesQueryOptions(courseId, page));
}

export function useCourseChatReplies(messageId?: string, page = 1) {
  return useQuery(courseChatRepliesQueryOptions(messageId, page));
}

export function useInfiniteCourseChatReplies(messageId?: string) {
  return useInfiniteQuery<
    GetRepliesResponse,
    Error,
    InfiniteData<GetRepliesResponse>,
    ReturnType<typeof getInfiniteCourseChatRepliesQueryKey>,
    number
  >({
    enabled: Boolean(messageId),
    queryKey: getInfiniteCourseChatRepliesQueryKey(messageId ?? "", COURSE_CHAT_REPLIES_PER_PAGE),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await ApiClient.api.courseChatControllerGetReplies(messageId ?? "", {
        page: pageParam,
        perPage: COURSE_CHAT_REPLIES_PER_PAGE,
      });

      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, perPage, totalItems } = lastPage.pagination;
      const nextPage = page + 1;

      return nextPage <= Math.ceil(totalItems / perPage) ? nextPage : undefined;
    },
  });
}

export function useCourseChatUsers(courseId: string) {
  return useQuery(courseChatUsersQueryOptions(courseId));
}

export function useCreateCourseChatMessage(courseId: string) {
  return useMutation({
    mutationFn: async (payload: CreateMessageBody) => {
      const response = await ApiClient.api.courseChatControllerCreateMessage(courseId, payload);

      return response.data.data;
    },
    onSuccess: (message) => {
      invalidateCourseChatMessageCreated({
        courseId: message.courseId,
        parentMessageId: message.parentMessageId,
      });
    },
  });
}

export function useToggleCourseChatMessageReaction() {
  return useMutation({
    mutationFn: async ({
      messageId,
      reaction,
    }: {
      messageId: string;
      reaction: ToggleMessageReactionBody["reaction"];
    }) => {
      const response = await ApiClient.api.courseChatControllerToggleMessageReaction(messageId, {
        reaction,
      });

      return response.data.data;
    },
    onSuccess: (payload) => {
      updateMessageReactionsInCache(payload);
    },
  });
}

export function useDeleteCourseChatMessage() {
  return useMutation({
    mutationFn: async (messageId: string) => {
      const response = await ApiClient.api.courseChatControllerDeleteMessage(messageId);

      return response.data.data;
    },
    onSuccess: (payload) => {
      updateDeletedMessageInCache(payload);
    },
  });
}
