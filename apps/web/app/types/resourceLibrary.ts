import type { EntityType } from "@repo/shared";

export type RichTextResourceLibraryEntityType = Extract<EntityType, "lesson" | "articles" | "news">;
