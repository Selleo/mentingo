import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";

export type CourseChatUserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  avatarReference: string | null;
};

export type CourseChatMessage = {
  id: string;
  threadId: string;
  courseId: string;
  userId: string;
  content: string;
  parentMessageId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: CourseChatUserProfile;
};

export type CourseChatThread = {
  id: string;
  courseId: string;
  createdByUserId: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  createdBy: CourseChatUserProfile;
  rootMessage: CourseChatMessage;
  latestMessage: CourseChatMessage | null;
};

export type CourseChatUser = CourseChatUserProfile & {
  isOnline: boolean;
};

type Paginated<T> = {
  data: T;
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
};

type BaseResponse<T> = {
  data: T;
};

export type CreateCourseChatThreadResponse = {
  thread: CourseChatThread;
  message: CourseChatMessage;
};

export type CreateCourseChatPayload = {
  content: string;
  mentionedUserIds?: string[];
};

export const COURSE_CHAT_THREADS_QUERY_KEY = ["course-chat", "threads"];
export const COURSE_CHAT_MESSAGES_QUERY_KEY = ["course-chat", "messages"];
export const COURSE_CHAT_USERS_QUERY_KEY = ["course-chat", "users"];

export const getCourseChatThreadsQueryKey = (courseId: string) => [
  ...COURSE_CHAT_THREADS_QUERY_KEY,
  courseId,
];

export const getCourseChatMessagesQueryKey = (threadId: string) => [
  ...COURSE_CHAT_MESSAGES_QUERY_KEY,
  threadId,
];

export const getCourseChatUsersQueryKey = (courseId: string) => [
  ...COURSE_CHAT_USERS_QUERY_KEY,
  courseId,
];

export const courseChatThreadsQueryOptions = (courseId: string) =>
  queryOptions({
    enabled: Boolean(courseId),
    queryKey: getCourseChatThreadsQueryKey(courseId),
    queryFn: async () => {
      const response = await ApiClient.request<Paginated<CourseChatThread[]>, unknown>({
        path: `/api/course-chat/${courseId}/threads`,
        method: "GET",
        query: { page: 1, perPage: 50 },
        secure: true,
      });

      return response.data;
    },
  });

export const courseChatMessagesQueryOptions = (threadId?: string) =>
  queryOptions({
    enabled: Boolean(threadId),
    queryKey: getCourseChatMessagesQueryKey(threadId ?? ""),
    queryFn: async () => {
      const response = await ApiClient.request<Paginated<CourseChatMessage[]>, unknown>({
        path: `/api/course-chat/threads/${threadId}/messages`,
        method: "GET",
        query: { page: 1, perPage: 100 },
        secure: true,
      });

      return response.data;
    },
  });

export const courseChatUsersQueryOptions = (courseId: string) =>
  queryOptions({
    enabled: Boolean(courseId),
    queryKey: getCourseChatUsersQueryKey(courseId),
    queryFn: async () => {
      const response = await ApiClient.request<BaseResponse<CourseChatUser[]>, unknown>({
        path: `/api/course-chat/${courseId}/users`,
        method: "GET",
        secure: true,
      });

      return response.data.data;
    },
  });

export function useCourseChatThreads(courseId: string) {
  return useQuery(courseChatThreadsQueryOptions(courseId));
}

export function useCourseChatThreadMessages(threadId?: string) {
  return useQuery(courseChatMessagesQueryOptions(threadId));
}

export function useCourseChatUsers(courseId: string) {
  return useQuery(courseChatUsersQueryOptions(courseId));
}

export function useCreateCourseChatThread(courseId: string) {
  return useMutation({
    mutationFn: async (payload: CreateCourseChatPayload) => {
      const response = await ApiClient.request<
        BaseResponse<CreateCourseChatThreadResponse>,
        unknown
      >({
        path: `/api/course-chat/${courseId}/threads`,
        method: "POST",
        body: payload,
        secure: true,
      });

      return response.data.data;
    },
    onSuccess: ({ thread }) => {
      upsertThreadInCache(thread);
    },
  });
}

export function useCreateCourseChatMessage(threadId?: string) {
  return useMutation({
    mutationFn: async (payload: CreateCourseChatPayload) => {
      if (!threadId) throw new Error("Missing threadId");

      const response = await ApiClient.request<BaseResponse<CourseChatMessage>, unknown>({
        path: `/api/course-chat/threads/${threadId}/messages`,
        method: "POST",
        body: payload,
        secure: true,
      });

      return response.data.data;
    },
    onSuccess: (message) => {
      upsertMessageInCache(message);
    },
  });
}

export function upsertThreadInCache(thread: CourseChatThread) {
  queryClient.setQueryData<Paginated<CourseChatThread[]>>(
    getCourseChatThreadsQueryKey(thread.courseId),
    (current) => {
      if (!current) return current;

      const existing = current.data.some((item) => item.id === thread.id);
      const data = existing
        ? current.data.map((item) => (item.id === thread.id ? thread : item))
        : [...current.data, thread];

      return {
        ...current,
        data,
        pagination: {
          ...current.pagination,
          totalItems: existing ? current.pagination.totalItems : current.pagination.totalItems + 1,
        },
      };
    },
  );
}

export function upsertMessageInCache(message: CourseChatMessage) {
  queryClient.setQueryData<Paginated<CourseChatMessage[]>>(
    getCourseChatMessagesQueryKey(message.threadId),
    (current) => {
      if (!current) return current;

      const exists = current.data.some((item) => item.id === message.id);
      const data = exists ? current.data : [...current.data, message];

      return {
        ...current,
        data,
        pagination: {
          ...current.pagination,
          totalItems: exists ? current.pagination.totalItems : current.pagination.totalItems + 1,
        },
      };
    },
  );

  queryClient.setQueryData<Paginated<CourseChatThread[]>>(
    getCourseChatThreadsQueryKey(message.courseId),
    (current) => {
      if (!current) return current;

      const data = current.data.map((thread) =>
        thread.id === message.threadId
          ? {
              ...thread,
              latestMessage: message,
              messageCount:
                thread.latestMessage?.id === message.id
                  ? thread.messageCount
                  : thread.messageCount + 1,
              updatedAt: message.createdAt,
            }
          : thread,
      );

      return { ...current, data };
    },
  );
}

export function updateCourseChatUserPresence(params: {
  courseId: string;
  userId: string;
  isOnline: boolean;
}) {
  queryClient.setQueryData<CourseChatUser[]>(
    getCourseChatUsersQueryKey(params.courseId),
    (current) =>
      current?.map((user) =>
        user.id === params.userId ? { ...user, isOnline: params.isOnline } : user,
      ),
  );
}
