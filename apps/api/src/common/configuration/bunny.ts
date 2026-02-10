import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  BUNNY_STREAM_API_KEY: Type.String(),
  BUNNY_STREAM_SIGNING_KEY: Type.String(),
  BUNNY_STREAM_LIBRARY_ID: Type.String(),
  BUNNY_STREAM_CDN_URL: Type.String(),
  BUNNY_STREAM_TOKEN_SIGNING_KEY: Type.String(),
});

type BunnyConfigSchema = Static<typeof schema>;

const validateBunnyConfig = configValidator(schema);

export default registerAs("bunny", (): BunnyConfigSchema => {
  const values = {
    BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY || "",
    BUNNY_STREAM_SIGNING_KEY: process.env.BUNNY_STREAM_SIGNING_KEY || "",
    BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID || "",
    BUNNY_STREAM_CDN_URL: process.env.BUNNY_STREAM_CDN_URL || "",
    BUNNY_STREAM_TOKEN_SIGNING_KEY: process.env.BUNNY_STREAM_TOKEN_SIGNING_KEY || "",
  };

  return validateBunnyConfig(values);
});
