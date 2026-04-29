import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { discussionsQueryOptions } from "../queries/useDiscussions";

import type {
  CourseDiscussionThread,
  CourseDiscussionThreadDetail,
} from "~/api/types/discussion.types";

export const DISCUSSION_DETAIL_QUERY_KEY = ["discussions", "detail"] as const;

export function discussionDetailQueryOptions(threadId: string) {
  return {
    queryKey: [...DISCUSSION_DETAIL_QUERY_KEY, threadId],
    queryFn: async () => {
      const response = await ApiClient.api.discussionDetailsControllerDetail(threadId);
      return response.data.data as CourseDiscussionThreadDetail;
    },
  };
}

export function useDiscussionDetail(threadId: string) {
  return useQuery(discussionDetailQueryOptions(threadId));
}

type CreateThreadOptions = {
  courseId: string;
  lessonId?: string;
  data: {
    title: string;
    content: string;
  };
};

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ courseId, lessonId, data }: CreateThreadOptions) => {
      if (lessonId) {
        const response = await ApiClient.api.courseDiscussionsControllerCreateLesson(
          courseId,
          lessonId,
          data,
        );
        return response.data.data as CourseDiscussionThread;
      }
      const response = await ApiClient.api.courseDiscussionsControllerCreate(courseId, data);
      return response.data.data as CourseDiscussionThread;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: discussionsQueryOptions(variables.courseId, variables.lessonId).queryKey,
      });
    },
  });
}

type UpdateThreadOptions = {
  threadId: string;
  courseId: string;
  lessonId?: string;
  data: {
    title?: string;
    content?: string;
  };
};

export function useUpdateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, data }: UpdateThreadOptions) => {
      const response = await ApiClient.api.discussionDetailsControllerUpdate(threadId, data);
      return response.data.data as CourseDiscussionThread;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...DISCUSSION_DETAIL_QUERY_KEY, variables.threadId],
      });
      queryClient.invalidateQueries({
        queryKey: discussionsQueryOptions(variables.courseId, variables.lessonId).queryKey,
      });
    },
  });
}

type DeleteThreadOptions = {
  threadId: string;
  courseId: string;
  lessonId?: string;
};

export function useDeleteThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId }: DeleteThreadOptions) => {
      await ApiClient.api.discussionDetailsControllerDelete(threadId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...DISCUSSION_DETAIL_QUERY_KEY, variables.threadId],
      });
      queryClient.invalidateQueries({
        queryKey: discussionsQueryOptions(variables.courseId, variables.lessonId).queryKey,
      });
    },
  });
}

type ModerateThreadOptions = {
  threadId: string;
  courseId: string;
  lessonId?: string;
  hidden: boolean;
};

export function useModerateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, hidden }: ModerateThreadOptions) => {
      const response = await ApiClient.api.discussionDetailsControllerModerateThread(threadId, {
        hidden,
      });
      return response.data.data as CourseDiscussionThread;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...DISCUSSION_DETAIL_QUERY_KEY, variables.threadId],
      });
      queryClient.invalidateQueries({
        queryKey: discussionsQueryOptions(variables.courseId, variables.lessonId).queryKey,
      });
    },
  });
}

type CreateCommentOptions = {
  threadId: string;
  courseId: string;
  data: {
    content: string;
  };
};

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, data }: CreateCommentOptions) => {
      const response = await ApiClient.api.discussionDetailsControllerCreateComment(threadId, data);
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...DISCUSSION_DETAIL_QUERY_KEY, variables.threadId],
      });
    },
  });
}

type UpdateCommentOptions = {
  commentId: string;
  threadId: string;
  data: {
    content: string;
  };
};

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, data }: UpdateCommentOptions) => {
      const response = await ApiClient.api.discussionCommentsControllerUpdateComment(
        commentId,
        data,
      );
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...DISCUSSION_DETAIL_QUERY_KEY, variables.threadId],
      });
    },
  });
}

type DeleteCommentOptions = {
  commentId: string;
  threadId: string;
};

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId }: DeleteCommentOptions) => {
      await ApiClient.api.discussionCommentsControllerDeleteComment(commentId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...DISCUSSION_DETAIL_QUERY_KEY, variables.threadId],
      });
    },
  });
}

type ModerateCommentOptions = {
  commentId: string;
  threadId: string;
  hidden: boolean;
};

export function useModerateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, hidden }: ModerateCommentOptions) => {
      const response = await ApiClient.api.discussionCommentsControllerModerateComment(commentId, {
        hidden,
      });
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...DISCUSSION_DETAIL_QUERY_KEY, variables.threadId],
      });
    },
  });
}
