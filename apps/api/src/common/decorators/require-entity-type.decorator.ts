import { SetMetadata } from "@nestjs/common";

import type { FeatureFlaggedEntityType } from "@repo/shared";

export const REQUIRED_ENTITY_TYPES_KEY = "required_entity_types";

export const RequireEntityType = (...entityTypes: FeatureFlaggedEntityType[]) =>
  SetMetadata(REQUIRED_ENTITY_TYPES_KEY, entityTypes);
