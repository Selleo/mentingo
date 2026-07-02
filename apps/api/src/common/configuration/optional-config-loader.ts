import { hasRequiredEnvsConfig } from "src/utils/hasRequiredEnvsConfig";

import awsConfig from "./aws";
import googleConfig from "./google";
import microsoftConfig from "./microsoft";
import slackConfig from "./slack";

// Access keys intentionally not required — on AWS the SDK default provider
// chain (ECS task role / instance profile) supplies credentials.
const hasAwsConfig = hasRequiredEnvsConfig(["AWS_BUCKET_NAME", "AWS_REGION"]);

export const hasGoogleConfig = hasRequiredEnvsConfig([
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_ENABLED",
]);

const hasSlackConfig = hasRequiredEnvsConfig([
  "SLACK_CLIENT_ID",
  "SLACK_CLIENT_SECRET",
  "SLACK_OAUTH_ENABLED",
]);

const hasMicrosoftConfig = hasRequiredEnvsConfig([
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "MICROSOFT_OAUTH_ENABLED",
]);

export const getOptionalConfigs = () => {
  return [
    ...(hasAwsConfig ? [awsConfig] : []),
    ...(hasGoogleConfig ? [googleConfig] : []),
    ...(hasSlackConfig ? [slackConfig] : []),
    ...(hasMicrosoftConfig ? [microsoftConfig] : []),
  ];
};
