import type { ResourceMetadata } from "./resource-metadata.type";
import type { ResourceCategory, ResourceRelationshipType } from "../file.constants";
import type { EntityType, SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { resources } from "src/storage/schema";

export type CreateResourceForEntityParams = {
  reference: string;
  contentType: string;
  entityId?: UUIDType;
  entityType?: EntityType;
  relationshipType?: ResourceRelationshipType;
  metadata?: Record<string, unknown>;
  title?: Partial<Record<SupportedLanguages, string>>;
  description?: Partial<Record<SupportedLanguages, string>>;
  currentUser?: CurrentUserType;
  contextId?: UUIDType;
};

export type UploadResourceParams = {
  file: Express.Multer.File;
  folder: string;
  resource: ResourceCategory;
  entityId?: string;
  entityType?: EntityType;
  relationshipType?: ResourceRelationshipType;
  title?: Partial<Record<SupportedLanguages, string>>;
  description?: Partial<Record<SupportedLanguages, string>>;
  currentUser?: CurrentUserType;
  options?: { folderIncludesResource?: boolean; contextId?: UUIDType };
};

export type LocalizedResourceText = Partial<Record<SupportedLanguages, string>>;

type ResourceForEntityBase = Omit<
  InferSelectModel<typeof resources>,
  "title" | "description" | "metadata"
> & {
  resourceEntityId: UUIDType;
  fileUrl: string;
  fileUrlError?: boolean;
};

export type RawResourceForEntity = ResourceForEntityBase & {
  title: LocalizedResourceText;
  description: LocalizedResourceText;
  metadata: ResourceMetadata | null;
};

export type LocalizedResourceForEntity = ResourceForEntityBase & {
  title: string;
  description: string;
  metadata: ResourceMetadata | null;
};

export type ResourceForEntity = RawResourceForEntity | LocalizedResourceForEntity;
