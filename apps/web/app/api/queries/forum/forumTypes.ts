import type {
  GetCourseDiscussionResponse,
  GetTopicPostsResponse,
  GetTopicResponse,
  GetTopicsResponse,
} from "~/api/generated-api";

export type ForumTopicListItem = GetTopicsResponse["data"][number];
export type ForumTopic = GetTopicResponse["data"];
export type ForumPost = GetTopicPostsResponse["data"][number];
export type ForumCourseDiscussion = GetCourseDiscussionResponse["data"];
