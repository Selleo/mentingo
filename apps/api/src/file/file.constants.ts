export const REDIS_TTL = 59 * 60 * 1000;
export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 5 * 1024 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4",
  "video/quicktime",
  "text/csv",
] as const;

export const EXTENSION_TO_MIME_TYPE_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

export const ALLOWED_EXCEL_MIME_TYPES_MAP = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

export const ALLOWED_EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
] as const;

export const RESOURCE_RELATIONSHIP_TYPES = {
  ATTACHMENT: "attachment",
  THUMBNAIL: "thumbnail",
  CONTENT: "content",
  COVER: "cover",
  ICON: "icon",
  BANNER: "banner",
  MEDIA: "media",
} as const;

export type ResourceRelationshipType =
  (typeof RESOURCE_RELATIONSHIP_TYPES)[keyof typeof RESOURCE_RELATIONSHIP_TYPES];

export const ENTITY_TYPES = {
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
  QUESTION: "question",
  NEWS: "news",
  ARTICLES: "articles",
  USER: "user",
  CATEGORY: "category",
  ANNOUNCEMENT: "announcement",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
export const RESOURCE_CATEGORIES = {
  NEWS: "news",
  ARTICLES: "articles",
} as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[keyof typeof RESOURCE_CATEGORIES];
