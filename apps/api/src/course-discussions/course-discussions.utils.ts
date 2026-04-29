export function sanitizeDiscussionText(value: string) {
  return value.replace(/\0/g, "").trim();
}

export const DISCUSSION_THREAD_TITLE_PLACEHOLDER = "Comment unavailable";
export const DISCUSSION_CONTENT_PLACEHOLDER = "This content is unavailable.";

export function shouldHideDiscussionContent(status: string, canModerate: boolean) {
  return !canModerate && (status === "hidden_by_staff" || status === "deleted_by_author");
}

export function applyThreadVisibility<T extends { title: string; content: string; status: string }>(
  thread: T,
  canModerate: boolean,
) {
  return shouldHideDiscussionContent(thread.status, canModerate)
    ? {
        ...thread,
        title: DISCUSSION_THREAD_TITLE_PLACEHOLDER,
        content: DISCUSSION_CONTENT_PLACEHOLDER,
      }
    : thread;
}

export function applyCommentVisibility<T extends { content: string; status: string }>(
  comment: T,
  canModerate: boolean,
) {
  return shouldHideDiscussionContent(comment.status, canModerate)
    ? { ...comment, content: DISCUSSION_CONTENT_PLACEHOLDER }
    : comment;
}
