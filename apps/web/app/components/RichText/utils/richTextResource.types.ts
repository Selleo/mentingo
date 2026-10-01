import {
  RICH_TEXT_RESOURCE_DISPLAY_MODE,
  RICH_TEXT_RESOURCE_TYPE,
  type EditableResourceVisibility,
  type EntityType,
  type RichTextResourceDisplayMode,
  type RichTextResourceType,
  type SupportedLanguages,
  type VideoProvider,
} from "@repo/shared";

import type { Editor as TiptapEditor } from "@tiptap/react";

export { RICH_TEXT_RESOURCE_DISPLAY_MODE, RICH_TEXT_RESOURCE_TYPE };
export type { RichTextResourceDisplayMode, RichTextResourceType };

export type UploadResourceArgs = {
  file: File;
  entityType: EntityType;
  entityId?: string;
  contextId?: string;
  language?: SupportedLanguages;
  title?: string;
  description?: string;
  visibility?: EditableResourceVisibility;
};

export type InsertResourceArgs = {
  editor?: TiptapEditor | null;
  resourceId: string;
  entityType: EntityType;
  file: Pick<File, "name">;
  resourceType?: RichTextResourceType;
  displayMode?: RichTextResourceDisplayMode;
  videoProvider?: VideoProvider;
};
