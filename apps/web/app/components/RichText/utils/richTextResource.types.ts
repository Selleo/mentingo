import type { EntityType, SupportedLanguages } from "@repo/shared";
import type { Editor as TiptapEditor } from "@tiptap/react";

export type UploadResourceArgs = {
  file: File;
  entityType: EntityType;
  entityId?: string;
  contextId?: string;
  language?: SupportedLanguages;
  title?: string;
  description?: string;
};

export const RICH_TEXT_RESOURCE_TYPE = {
  IMAGE: "image",
  VIDEO: "video",
  PRESENTATION: "presentation",
  PDF: "pdf",
  DOCUMENT: "document",
  OTHER: "other",
} as const;

export type RichTextResourceType =
  (typeof RICH_TEXT_RESOURCE_TYPE)[keyof typeof RICH_TEXT_RESOURCE_TYPE];

export const RICH_TEXT_RESOURCE_DISPLAY_MODE = {
  PREVIEW: "preview",
  DOWNLOAD: "download",
} as const;

export type RichTextResourceDisplayMode =
  (typeof RICH_TEXT_RESOURCE_DISPLAY_MODE)[keyof typeof RICH_TEXT_RESOURCE_DISPLAY_MODE];

export type InsertResourceArgs = {
  editor?: TiptapEditor | null;
  resourceId: string;
  entityType: EntityType;
  file: Pick<File, "name">;
  resourceType?: RichTextResourceType;
  displayMode?: RichTextResourceDisplayMode;
};
