import type { IntegrationKeyMetadata } from "./schemas/integration-key.schema";
import type { Request } from "express";
import type { CurrentUser } from "src/common/types/current-user.type";

export type IntegrationKeyMetadataRecord = {
  id: string;
  keyPrefix: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

export type RotateIntegrationKeyParams = {
  userId: string;
  tenantId: string;
  keyPrefix: string;
  keyHash: string;
};

export type FindIntegrationKeyCandidateParams = {
  keyPrefix: string;
};

export type IntegrationApiKeyCandidate = {
  keyId: string;
  keyHash: string;
  keyTenantId: string;
  keyTenantIsManaging: boolean;
  userId: string;
  userEmail: string;
  userRole: string;
  userDeletedAt: string | null;
};

export type IntegrationRequest = Request & {
  user?: CurrentUser;
  integrationTenantValidated?: boolean;
  integrationApiKeyId?: string;
};

export type CurrentAdminKeyData = {
  key: IntegrationKeyMetadata | null;
};

export type RotateAdminKeyData = {
  key: string;
  metadata: IntegrationKeyMetadata;
};
