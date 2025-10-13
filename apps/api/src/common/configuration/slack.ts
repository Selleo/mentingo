import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const slackAuthCallbackURL = `${
  process.env.CORS_ORIGIN || "http://localhost:5173"
}/api/auth/slack/callback`;

const schema = Type.Object({
  SLACK_CLIENT_ID: Type.String(),
  SLACK_CLIENT_SECRET: Type.String(),
});

type SlackConfigSchema = Static<typeof schema>;

const validateSlackConfig = configValidator(schema);

export default registerAs("slack_authorization", (): SlackConfigSchema => {
  const values = {
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || "",
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || "",
    callbackURL: slackAuthCallbackURL,
  };

  return validateSlackConfig(values);
});
