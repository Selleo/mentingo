import { SetMetadata } from "@nestjs/common";

import type { FeatureKey } from "@repo/shared";

export const REQUIRED_FEATURES_KEY = "required_features";

export const RequireFeature = (...features: FeatureKey[]) =>
  SetMetadata(REQUIRED_FEATURES_KEY, features);
