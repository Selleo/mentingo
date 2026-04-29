import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { getCourseQueryKey } from "~/api/queries/useCourse";

import {
  COMMENTS_POLL_INTERVAL_MS,
  type ListCourseCommentsResponse,
  type ListRepliesResponse,
} from "./types";

export const courseCommentsQueryKey = (courseId: string) => ["course-comments", courseId];

export const courseCommentRepliesQueryKey = (courseId: string, parentId: string) => [
  "course-comment-replies",
  courseId,
  parentId,
];

export const courseCommentsQueryOptions = (courseId: string) =>
  infiniteQueryOptions({
    queryKey: courseCommentsQueryKey(courseId),
    initialPageParam: undefined as string | undefined,
    refetchInterval: COMMENTS_POLL_INTERVAL_MS,
    getNextPageParam: (last: { data: ListCourseCommentsResponse }) =>
      last.data.nextCursor ?? undefined,
    queryFn: async ({ pageParam }) => {
      const response = await ApiClient.instance.get<{ data: ListCourseCommentsResponse }>(
        `/api/courses/${courseId}/comments`,
        {
          params: pageParam ? { cursor: pageParam } : undefined,
        },
      );
      return response.data;
    },
  });

export function useCourseComments(courseId: string, enabled = true) {
  return useInfiniteQuery({
    ...courseCommentsQueryOptions(courseId),
    enabled,
  });
}

export const courseCommentRepliesQueryOptions = (courseId: string, parentId: string) =>
  infiniteQueryOptions({
    queryKey: courseCommentRepliesQueryKey(courseId, parentId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: { data: ListRepliesResponse }) => last.data.nextCursor ?? undefined,
    queryFn: async ({ pageParam }) => {
      const response = await ApiClient.instance.get<{ data: ListRepliesResponse }>(
        `/api/courses/${courseId}/comments/${parentId}/replies`,
        {
          params: pageParam ? { cursor: pageParam } : undefined,
        },
      );
      return response.data;
    },
  });

export function useCourseCommentReplies(courseId: string, parentId: string, enabled = true) {
  return useInfiniteQuery({
    ...courseCommentRepliesQueryOptions(courseId, parentId),
    enabled,
  });
}

export function useCreateCourseComment(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { content: string; parentCommentId?: string }) => {
      const response = await ApiClient.instance.post(`/api/courses/${courseId}/comments`, payload);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: courseCommentsQueryKey(courseId) });
      queryClient.invalidateQueries({ queryKey: getCourseQueryKey(courseId) });
      if (variables.parentCommentId) {
        queryClient.invalidateQueries({
          queryKey: courseCommentRepliesQueryKey(courseId, variables.parentCommentId),
        });
      }
    },
  });
}

export function useUpdateCourseComment(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const response = await ApiClient.instance.patch(`/api/comments/${commentId}`, {
        content,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseCommentsQueryKey(courseId) });
    },
  });
}

export function useDeleteCourseComment(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string; parentCommentId?: string | null }) => {
      const response = await ApiClient.instance.delete(`/api/comments/${commentId}`);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: courseCommentsQueryKey(courseId) });
      queryClient.invalidateQueries({ queryKey: getCourseQueryKey(courseId) });
      if (variables.parentCommentId) {
        queryClient.invalidateQueries({
          queryKey: courseCommentRepliesQueryKey(courseId, variables.parentCommentId),
        });
      }
    },
  });
}
