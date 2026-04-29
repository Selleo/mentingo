export function sanitizeDiscussionText(value: string) {
  return value.replace(/\0/g, "").trim();
}
