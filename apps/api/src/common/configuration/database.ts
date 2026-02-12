import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  urlApp: Type.String(),
  urlAdmin: Type.String(),
});

type DatabaseConfig = Static<typeof schema>;

const validateDatabaseConfig = configValidator(schema);

export default registerAs("database", (): DatabaseConfig => {
  const fallbackUrl = process.env.DATABASE_URL;
  const values = {
    urlApp: process.env.LMS_DATABASE_URL || fallbackUrl,
    urlAdmin: process.env.MIGRATOR_DATABASE_URL || fallbackUrl,
  };

  return validateDatabaseConfig(values);
});
