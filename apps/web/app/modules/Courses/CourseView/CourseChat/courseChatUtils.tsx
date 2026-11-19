import { buildMentionPattern, findMentionedUserIds } from "@repo/shared";

import type { MentionableUser } from "~/api/queries/course-chat/courseChatTypes";

const mentionPatternByUsers = new WeakMap<MentionableUser[], RegExp | null>();

export function getUserDisplayName(user: Pick<MentionableUser, "firstName" | "lastName">) {
  return `${user.firstName} ${user.lastName}`;
}

export function getActiveMentionQuery(value: string) {
  const match = value.match(/(^|\s)@([^\s@]*)$/);

  return match?.[2] ?? null;
}

export function getMentionedUserIds(content: string, users: MentionableUser[]) {
  return findMentionedUserIds(content, users);
}

export function renderMessageContent(content: string, users: MentionableUser[]) {
  const mentionPattern = getMentionPattern(users);

  if (!mentionPattern) return content;

  return content.split(mentionPattern).map((part, index) =>
    index % 2 === 1 ? (
      <span key={`${part}-${index}`} className="font-medium text-primary-700">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function getMentionPattern(users: MentionableUser[]) {
  const cachedPattern = mentionPatternByUsers.get(users);

  if (cachedPattern !== undefined) return cachedPattern;

  const mentionPattern = buildMentionPattern(users);
  mentionPatternByUsers.set(users, mentionPattern);

  return mentionPattern;
}
