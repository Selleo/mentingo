export const RICH_TEXT_VIEWER_VARIANT = {
  DEFAULT: "default",
  ARTICLE: "article",
  NEWS: "news",
  CONTENT: "content",
} as const;

export type RichTextViewerVariant =
  (typeof RICH_TEXT_VIEWER_VARIANT)[keyof typeof RICH_TEXT_VIEWER_VARIANT];
