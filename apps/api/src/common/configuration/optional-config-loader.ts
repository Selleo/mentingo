import { hasRequiredEnvsConfig } from "src/utils/hasRequiredEnvsConfig";

import awsConfig from "./aws";

const hasAwsConfig = hasRequiredEnvsConfig([
  "AWS_BUCKET_NAME",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
]);

export const getOptionalConfigs = () => {
  return [...(hasAwsConfig ? [awsConfig] : [])];
};
