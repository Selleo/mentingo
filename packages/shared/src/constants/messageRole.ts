export const MESSAGE_ROLE = {
  SYSTEM: "system",
  USER: "user",
  MENTOR: "assistant",
  TOOL: "tool",
  SUMMARY: "summary",
} as const;

export type MessageRole = (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];
