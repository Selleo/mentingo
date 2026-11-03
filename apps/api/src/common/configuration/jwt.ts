import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const secretSchema = Type.String({ minLength: 1, pattern: "\\S" });

const schema = Type.Object({
  secret: secretSchema,
  refreshSecret: secretSchema,
  expirationTime: Type.String(),
});

type JWTConfig = Static<typeof schema>;

const validateJWTConfig = configValidator(schema);

export default registerAs("jwt", (): JWTConfig => {
  const values = {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expirationTime: process.env.JWT_EXPIRATION_TIME,
  };

  return validateJWTConfig(values);
});
