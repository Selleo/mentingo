import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  LIVEKIT_URL: Type.String(),
  LIVEKIT_API_KEY: Type.String(),
  LIVEKIT_API_SECRET: Type.String(),
});

export type LiveKitConfigSchema = Static<typeof schema>;

const validateLiveKitConfig = configValidator(schema);

export default registerAs("livekit", (): LiveKitConfigSchema => {
  const values = {
    LIVEKIT_URL: process.env.LIVEKIT_URL || "",
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || "",
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || "",
  };

  return validateLiveKitConfig(values);
});
