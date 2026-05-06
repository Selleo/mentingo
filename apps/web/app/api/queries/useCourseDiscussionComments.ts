import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export type CourseDiscussionComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  isHelpfulAnswer: boolean;
  depth: number;
};

export const getCourseDiscussionCommentsQueryKey = (courseId: string, postId: string) => [
  "course-discussion-comments",
  { courseId, postId },
];

export const courseDiscussionCommentsQueryOptions = (courseId: string, postId: string) =>
  queryOptions({
    queryKey: getCourseDiscussionCommentsQueryKey(courseId, postId),
    queryFn: async () => {
      const response = await ApiClient.instance.get<{ data: CourseDiscussionComment[] }>(
        `/api/course/${courseId}/discussion/posts/${postId}/comments`,
      );

      return response.data.data;
    },
    enabled: Boolean(courseId && postId),
  });

export function useCourseDiscussionComments(courseId: string, postId: string) {
  return useQuery(courseDiscussionCommentsQueryOptions(courseId, postId));
}
