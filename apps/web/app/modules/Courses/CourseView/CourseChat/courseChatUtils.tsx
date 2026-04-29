import type { CourseChatUser } from "~/api/queries/course-chat/useCourseChat";

export function getUserDisplayName(user: CourseChatUser) {
  return `${user.firstName} ${user.lastName}`;
}

export function getActiveMentionQuery(value: string) {
  const match = value.match(/(^|\s)@([^\s@]*)$/);

  return match?.[2] ?? null;
}

export function getMentionedUserIds(content: string, users: CourseChatUser[]) {
  return users
    .filter((user) => content.includes(`@${getUserDisplayName(user)}`))
    .map((user) => user.id);
}

export function renderMessageContent(content: string, users: CourseChatUser[]) {
  const mentionLabels = users
    .map((user) => `@${getUserDisplayName(user)}`)
    .sort((a, b) => b.length - a.length);

  if (!mentionLabels.length) return content;

  const mentionRegex = new RegExp(`(${mentionLabels.map(escapeRegExp).join("|")})`, "g");

  return content.split(mentionRegex).map((part, index) =>
    mentionLabels.includes(part) ? (
      <span key={`${part}-${index}`} className="font-medium text-primary-700">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
