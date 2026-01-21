import type { ResourceCategory, ResourceRelationshipType, EntityType } from "../file.constants";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

export type CreateResourceForEntityParams = {
  reference: string;
  contentType: string;
  entityId?: UUIDType;
  entityType?: EntityType;
  relationshipType?: ResourceRelationshipType;
  metadata?: Record<string, unknown>;
  title?: Partial<Record<SupportedLanguages, string>>;
  description?: Partial<Record<SupportedLanguages, string>>;
  currentUser?: CurrentUser;
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
  currentUser?: CurrentUser;
  options?: { folderIncludesResource?: boolean; contextId?: UUIDType };
};
