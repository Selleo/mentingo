import type {
  GetCourseChatUsersResponse,
  GetMessagesResponse,
  GetRepliesResponse,
} from "~/api/generated-api";

export type CourseChatMessage = GetMessagesResponse["data"][number];
export type CourseChatMessagePreview = NonNullable<CourseChatMessage["latestReply"]>;
export type CourseChatMessageReaction = CourseChatMessage["reactions"][number];
export type CourseChatUser = GetCourseChatUsersResponse["data"][number];
export type CourseChatUserProfile = CourseChatMessage["user"];
export type CourseChatRepliesResponse = GetRepliesResponse;
