export const DISCUSSION_NOTIFICATION_PREFERENCES = {
  REPLY_EMAILS: "discussionReplyEmails",
  REPLY_IN_APP: "discussionReplyInApp",
  MENTION_EMAILS: "mentionEmails",
} as const;

export type DiscussionNotificationPreference =
  (typeof DISCUSSION_NOTIFICATION_PREFERENCES)[keyof typeof DISCUSSION_NOTIFICATION_PREFERENCES];

export const DISCUSSION_UNSUBSCRIBE_TYPES = {
  REPLIES: "replies",
  MENTIONS: "mentions",
  THREAD: "thread",
} as const;

export type DiscussionUnsubscribeType =
  (typeof DISCUSSION_UNSUBSCRIBE_TYPES)[keyof typeof DISCUSSION_UNSUBSCRIBE_TYPES];

export const DISCUSSION_EMAIL_LINK_FIELDS = {
  UNSUBSCRIBE: "unsubscribe_link",
  UNFOLLOW: "unfollow_link",
} as const;

export const DISCUSSION_UNSUBSCRIBE_PATH = "/notifications/unsubscribe";
export const DISCUSSION_UNSUBSCRIBE_TOKEN_PARAM = "token";

export const getDiscussionUnsubscribePath = (token: string) =>
  `${DISCUSSION_UNSUBSCRIBE_PATH}?${DISCUSSION_UNSUBSCRIBE_TOKEN_PARAM}=${encodeURIComponent(token)}`;
