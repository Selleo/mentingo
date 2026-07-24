import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  MICROSOFT_CLIENT_ID: Type.String(),
  MICROSOFT_CLIENT_SECRET: Type.String(),
  MICROSOFT_CALENDAR_CLIENT_ID: Type.String(),
  MICROSOFT_CALENDAR_CLIENT_SECRET: Type.String(),
  MICROSOFT_MENTINGO_MARKER_PROPERTY: Type.String(),
});

type MicrosoftConfigSchema = Static<typeof schema>;

const validateMicrosoftConfig = configValidator(schema);

export default registerAs("microsoft_authorization", (): MicrosoftConfigSchema => {
  const values = {
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || "",
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || "",
    MICROSOFT_CALENDAR_CLIENT_ID: process.env.MICROSOFT_CALENDAR_CLIENT_ID || "",
    MICROSOFT_CALENDAR_CLIENT_SECRET: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || "",
    MICROSOFT_MENTINGO_MARKER_PROPERTY:
      process.env.MICROSOFT_MENTINGO_MARKER_PROPERTY ||
      "String {8f1c0f91-9f8a-4f2e-9e2e-4c454e54494e} Name MentingoManaged",
  };

  return validateMicrosoftConfig(values);
});
