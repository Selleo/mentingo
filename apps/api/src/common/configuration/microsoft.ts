import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  MICROSOFT_CLIENT_ID: Type.String(),
  MICROSOFT_CLIENT_SECRET: Type.String(),
});

type MicrosoftConfigSchema = Static<typeof schema>;

const validateMicrosoftConfig = configValidator(schema);

export default registerAs("microsoft_authorization", (): MicrosoftConfigSchema => {
  const values = {
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || "",
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || "",
  };

  return validateMicrosoftConfig(values);
});
