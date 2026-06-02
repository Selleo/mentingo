import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

export const DEFAULT_CALLBACK_BASE_URL = process.env.CORS_ORIGIN || "http://localhost:5173";

export const getCallbackPath = (name: string) => `/api/auth/${name}/callback`;

export const getCallbackUrl = (name: string, baseUrl = DEFAULT_CALLBACK_BASE_URL) =>
  `${baseUrl.replace(/\/$/, "")}${getCallbackPath(name)}`;

const schema = Type.Object({
  MICROSOFT: Type.String(),
  SLACK: Type.String(),
  GOOGLE: Type.String(),
});

type CallbackUrlConfigSchema = Static<typeof schema>;

const validateCallbackUrlConfig = configValidator(schema);

export default registerAs("callback_url", (): CallbackUrlConfigSchema => {
  const values = {
    MICROSOFT: getCallbackUrl("microsoft"),
    SLACK: getCallbackUrl("slack"),
    GOOGLE: getCallbackUrl("google"),
  };

  return validateCallbackUrlConfig(values);
});
