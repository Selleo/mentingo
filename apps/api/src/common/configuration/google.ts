import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  GOOGLE_CLIENT_ID: Type.String(),
  GOOGLE_CLIENT_SECRET: Type.String(),
});

type GoogleConfigSchema = Static<typeof schema>;

const validateGoogleConfig = configValidator(schema);

export default registerAs("google_authorization", (): GoogleConfigSchema => {
  const values = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  };

  return validateGoogleConfig(values);
});
