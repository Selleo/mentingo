export type CourseCommentAuthor = {
  id: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
};

export type CourseComment = {
  id: string;
  courseId: string;
  parentCommentId: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
  author: CourseCommentAuthor | null;
};

export type CourseCommentWithReplies = CourseComment & {
  replies: CourseComment[];
};

export type ListCourseCommentsResponse = {
  data: CourseCommentWithReplies[];
  nextCursor: string | null;
};

export type ListRepliesResponse = {
  data: CourseComment[];
  nextCursor: string | null;
};

export const COMMENT_CONTENT_MAX = 2000;
export const COMMENTS_POLL_INTERVAL_MS = 30_000;
