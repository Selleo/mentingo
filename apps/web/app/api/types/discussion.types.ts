export type CourseDiscussionThread = {
  id: string;
  courseId: string;
  lessonId: string | null;
  authorId: string;
  title: string;
  content: string;
  status: "visible" | "deleted_by_author" | "hidden_by_staff";
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CourseDiscussionComment = {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  status: "visible" | "deleted_by_author" | "hidden_by_staff";
  createdAt: string;
  updatedAt: string;
};

export type CourseDiscussionThreadDetail = CourseDiscussionThread & {
  comments: CourseDiscussionComment[];
};
