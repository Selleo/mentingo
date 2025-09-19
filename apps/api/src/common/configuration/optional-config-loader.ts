import { hasRequiredEnvsConfig } from "src/utils/hasRequiredEnvsConfig";

import awsConfig from "./aws";
import googleConfig from "./google";

const hasAwsConfig = hasRequiredEnvsConfig([
  "AWS_BUCKET_NAME",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
]);

export const hasGoogleConfig = hasRequiredEnvsConfig([
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_ENABLED",
]);

export const getOptionalConfigs = () => {
  return [...(hasAwsConfig ? [awsConfig] : []), ...(hasGoogleConfig ? [googleConfig] : [])];
};
