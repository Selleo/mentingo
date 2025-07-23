import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const microsoftAuthCallbackURL = `${
  process.env.CORS_ORIGIN || "http://localhost:3000"
}/api/auth/microsoft/callback`;

const schema = Type.Object({
  MICROSOFT_CLIENT_ID: Type.String(),
  MICROSOFT_CLIENT_SECRET: Type.String(),
  callbackURL: Type.String(),
});

type MicrosoftConfigSchema = Static<typeof schema>;

const validateMicrosoftConfig = configValidator(schema);

export default registerAs("microsoft_authorization", (): MicrosoftConfigSchema => {
  const values = {
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || "",
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || "",
    callbackURL: microsoftAuthCallbackURL,
  };

  return validateMicrosoftConfig(values);
});
