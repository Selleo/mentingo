import { SetMetadata } from "@nestjs/common";

import type { FeatureKey } from "@repo/shared";

export const REQUIRED_FEATURES_KEY = "required_features";

export interface RequireFeatureOptions {
  allowUnregisteredUser?: boolean;
}

export interface FeatureMetadata {
  feature: FeatureKey;
  allowUnregisteredUser?: boolean;
}

type RequireFeatureArgs = [...FeatureKey[], RequireFeatureOptions] | FeatureKey[];

export const RequireFeature = (...args: RequireFeatureArgs) => {
  const last = args[args.length - 1];
  const hasOptions = typeof last === "object" && last !== null;

  const options = (hasOptions ? last : undefined) as RequireFeatureOptions | undefined;
  const features = (hasOptions ? args.slice(0, -1) : args) as FeatureKey[];

  const metadata: FeatureMetadata[] = features.map((feature) => ({
    feature,
    allowUnregisteredUser: options?.allowUnregisteredUser,
  }));

  return SetMetadata(REQUIRED_FEATURES_KEY, metadata);
};
