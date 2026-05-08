import { queryOptions } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import {
  getCourseChatMessagesQueryKey,
  getCourseChatRepliesQueryKey,
  getCourseChatUsersQueryKey,
} from "./courseChatQueryKeys";

export const COURSE_CHAT_MESSAGES_PER_PAGE = 10;
export const COURSE_CHAT_REPLIES_PER_PAGE = 100;

export const courseChatMessagesQueryOptions = (courseId: string, page = 1) =>
  queryOptions({
    enabled: Boolean(courseId),
    queryKey: getCourseChatMessagesQueryKey(courseId, page, COURSE_CHAT_MESSAGES_PER_PAGE),
    queryFn: async () => {
      const response = await ApiClient.api.courseChatControllerGetMessages(courseId, {
        page,
        perPage: COURSE_CHAT_MESSAGES_PER_PAGE,
      });

      return response.data;
    },
  });

export const courseChatRepliesQueryOptions = (messageId?: string, page = 1) =>
  queryOptions({
    enabled: Boolean(messageId),
    queryKey: getCourseChatRepliesQueryKey(messageId ?? "", page, COURSE_CHAT_REPLIES_PER_PAGE),
    queryFn: async () => {
      const response = await ApiClient.api.courseChatControllerGetReplies(messageId ?? "", {
        page,
        perPage: COURSE_CHAT_REPLIES_PER_PAGE,
      });

      return response.data;
    },
  });

export const courseChatUsersQueryOptions = (courseId: string) =>
  queryOptions({
    enabled: Boolean(courseId),
    queryKey: getCourseChatUsersQueryKey(courseId),
    queryFn: async () => {
      const response = await ApiClient.api.courseChatControllerGetCourseChatUsers(courseId);

      return response.data.data;
    },
  });
