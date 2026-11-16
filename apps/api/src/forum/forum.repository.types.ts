import type { UUIDType } from "src/common";

export type ForumThreadContext = {
  id: UUIDType;
  firstPostId: UUIDType;
  firstPostDeletedAt: string | null;
  replyCount: number;
};

export type ForumPostContext = {
  id: UUIDType;
  threadId: UUIDType;
  userId: UUIDType;
  parentMessageId: UUIDType | null;
  deletedAt: string | null;
};

export type ForumPostRow = {
  id: UUIDType;
  threadId: UUIDType;
  userId: UUIDType;
  content: string;
  parentMessageId: UUIDType | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorFirstName: string;
  authorLastName: string;
  authorAvatarReference: string | null;
};

export type ForumTopicRow = {
  id: UUIDType;
  title: string;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  firstPostId: UUIDType;
  firstPostUserId: UUIDType;
  firstPostContent: string;
  firstPostDeletedAt: string | null;
  firstPostCreatedAt: string;
  firstPostUpdatedAt: string;
  authorFirstName: string;
  authorLastName: string;
  authorAvatarReference: string | null;
};

export type ForumCourseDiscussionRow = {
  courseId: UUIDType;
  courseTitle: string;
  messageCount: number;
  lastActivityAt: string | null;
};
