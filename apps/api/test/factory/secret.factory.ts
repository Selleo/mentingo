import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { INTERNAL_SECRETS } from "src/env/env.config";

import type { EnvService } from "src/env/services/env.service";

type SecretTest = { name: string; value: string };

/** Stores encrypted secrets through `EnvService`; call `create` inside a tenant context. */
export const createSecretFactory = (envService: EnvService) =>
  Factory.define<SecretTest>(({ onCreate }) => {
    onCreate(async (secret) => {
      if (INTERNAL_SECRETS.includes(secret.name)) {
        await envService.bulkUpsertInternalEnv([secret]);
      } else {
        await envService.bulkUpsertEnv([secret]);
      }

      return secret;
    });

    return {
      name: "GOOGLE_CLIENT_ID",
      value: faker.string.alphanumeric(16),
    };
  });
