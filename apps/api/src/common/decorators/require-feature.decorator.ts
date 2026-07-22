import { SetMetadata } from "@nestjs/common";

import type { FeatureKey } from "@repo/shared";

export const REQUIRED_FEATURES_KEY = "required_features";

export interface RequireFeatureConfig {
  features: FeatureKey[];
  allowUnregisteredUser?: boolean;
}

export const RequireFeature = (requireFeatureConfig: RequireFeatureConfig) =>
  SetMetadata(REQUIRED_FEATURES_KEY, requireFeatureConfig);
