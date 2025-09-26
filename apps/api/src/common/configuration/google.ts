import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const googleAuthCallbackURL = `${
  process.env.CORS_ORIGIN || "http://localhost:5173"
}/api/auth/google/callback`;

const schema = Type.Object({
  GOOGLE_CLIENT_ID: Type.String(),
  GOOGLE_CLIENT_SECRET: Type.String(),
  callbackURL: Type.String(),
});

type GoogleConfigSchema = Static<typeof schema>;

const validateGoogleConfig = configValidator(schema);

export default registerAs("google_authorization", (): GoogleConfigSchema => {
  const values = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: googleAuthCallbackURL,
  };

  return validateGoogleConfig(values);
});
