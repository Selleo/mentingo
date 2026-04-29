import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export type DiscussionFilter = "all" | "questions" | "latest" | "pinned";

export type CourseDiscussionPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  type: "question" | "discussion" | "progress";
  content: string;
  createdAt: string;
  commentsCount: number;
  reactions: {
    like: number;
    heart: number;
    celebrate: number;
  };
  isPinned: boolean;
};

export const getCourseDiscussionPostsQueryKey = (courseId: string, filter: DiscussionFilter) => [
  "course-discussion-posts",
  { courseId, filter },
];

export const courseDiscussionPostsQueryOptions = (courseId: string, filter: DiscussionFilter) =>
  queryOptions({
    queryKey: getCourseDiscussionPostsQueryKey(courseId, filter),
    queryFn: async () => {
      const response = await ApiClient.instance.get<{ data: CourseDiscussionPost[] }>(
        `/api/course/${courseId}/discussion/posts`,
        { params: { filter } },
      );

      return response.data.data;
    },
    enabled: Boolean(courseId),
  });

export function useCourseDiscussionPosts(courseId: string, filter: DiscussionFilter) {
  return useQuery(courseDiscussionPostsQueryOptions(courseId, filter));
}
