import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  reservedSubdomains: Type.Array(Type.String({ minLength: 1 })),
});

type TenantsConfig = Static<typeof schema>;

const validateTenantsConfig = configValidator(schema);

export default registerAs("tenants", (): TenantsConfig => {
  const values = {
    reservedSubdomains: (process.env.RESERVED_TENANT_SUBDOMAINS ?? "")
      .split(",")
      .map((subdomain) => subdomain.trim().toLowerCase())
      .filter(Boolean),
  };

  return validateTenantsConfig(values);
});
