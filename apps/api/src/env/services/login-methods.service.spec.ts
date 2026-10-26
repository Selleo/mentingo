import { NotFoundException } from "@nestjs/common";
import { LOGIN_METHOD_ERROR_KEYS, LOGIN_METHODS } from "@repo/shared";

import { LoginMethodsService } from "./login-methods.service";

import type { EnvService } from "./env.service";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { UpdateLoginMethodBody } from "src/env/env.schema";
import type { EnvRepository } from "src/env/repositories/env.repository";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

const ACTOR = { userId: "admin" } as CurrentUserType;

/** Every OAuth flag and credential is set explicitly so process env fallbacks never leak in. */
const NO_OAUTH_PROVIDERS = {
  GOOGLE_OAUTH_ENABLED: "false",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  MICROSOFT_OAUTH_ENABLED: "false",
  MICROSOFT_CLIENT_ID: "",
  MICROSOFT_CLIENT_SECRET: "",
  SLACK_OAUTH_ENABLED: "false",
  SLACK_CLIENT_ID: "",
  SLACK_CLIENT_SECRET: "",
};

const createLoginMethodsService = (
  storedSecrets: Record<string, string> = {},
  { enforceSSO = false } = {},
) => {
  const secrets = { ...NO_OAUTH_PROVIDERS, ...storedSecrets };
  const envService = {
    getEnv: jest.fn(async (name: string) => {
      if (!(name in secrets)) throw new NotFoundException("Secret not found");

      return { name, value: secrets[name as keyof typeof secrets] };
    }),
    bulkUpsertInternalEnv: jest.fn(),
  };
  const envRepository = {
    findGlobalSettingsForUpdate: jest.fn().mockResolvedValue({ enforceSSO }),
  };
  const tenantDbRunnerService = {
    transaction: jest.fn((transactionBody: () => Promise<unknown>) => transactionBody()),
  };

  const loginMethodsService = new LoginMethodsService(
    envService as unknown as EnvService,
    envRepository as unknown as EnvRepository,
    tenantDbRunnerService as unknown as TenantDbRunnerService,
  );

  return { loginMethodsService, envService, envRepository, tenantDbRunnerService };
};

type RejectedUpdate = {
  title: string;
  storedSecrets: Record<string, string>;
  enforceSSO: boolean;
  update: UpdateLoginMethodBody;
  expectedError: string;
};

const REJECTED_UPDATES: RejectedUpdate[] = [
  {
    title: "enabling a provider without credentials",
    storedSecrets: {},
    enforceSSO: false,
    update: { method: LOGIN_METHODS.MICROSOFT, enabled: true },
    expectedError: LOGIN_METHOD_ERROR_KEYS.MISSING_CONFIGURATION,
  },
  {
    title: "enabling a provider with only part of its credentials",
    storedSecrets: { MICROSOFT_CLIENT_ID: "microsoft-id" },
    enforceSSO: false,
    update: { method: LOGIN_METHODS.MICROSOFT, enabled: true },
    expectedError: LOGIN_METHOD_ERROR_KEYS.MISSING_CONFIGURATION,
  },
  {
    title: "disabling the last usable login method",
    storedSecrets: { MAGIC_LINK_LOGIN_ENABLED: "false" },
    enforceSSO: false,
    update: { method: LOGIN_METHODS.PASSWORD, enabled: false },
    expectedError: LOGIN_METHOD_ERROR_KEYS.LAST_METHOD,
  },
  {
    title: "counting an enabled but unconfigured provider as a lockout escape",
    storedSecrets: { MAGIC_LINK_LOGIN_ENABLED: "false", GOOGLE_OAUTH_ENABLED: "true" },
    enforceSSO: false,
    update: { method: LOGIN_METHODS.PASSWORD, enabled: false },
    expectedError: LOGIN_METHOD_ERROR_KEYS.LAST_METHOD,
  },
  {
    title: "counting password login while SSO enforcement blocks it",
    storedSecrets: {},
    enforceSSO: true,
    update: { method: LOGIN_METHODS.MAGIC_LINK, enabled: false },
    expectedError: LOGIN_METHOD_ERROR_KEYS.LAST_METHOD,
  },
];

describe("LoginMethodsService", () => {
  it("fails closed instead of enabling defaults when secret storage fails", async () => {
    const { loginMethodsService, envService } = createLoginMethodsService();
    envService.getEnv.mockRejectedValue(new Error("storage unavailable"));

    await expect(loginMethodsService.getLoginMethods()).rejects.toThrow("storage unavailable");
  });

  it("enables password and magic link by default and exposes no provider secrets", async () => {
    const { loginMethodsService } = createLoginMethodsService({
      GOOGLE_CLIENT_SECRET: "private-value",
    });

    const loginMethods = await loginMethodsService.getLoginMethods();

    expect(loginMethods).toEqual({
      google: false,
      microsoft: false,
      slack: false,
      magicLink: true,
      password: true,
    });
    expect(JSON.stringify(loginMethods)).not.toContain("private-value");
  });

  it("reports missing login credentials by name, never by value", async () => {
    const { loginMethodsService } = createLoginMethodsService({
      MICROSOFT_CLIENT_ID: "existing-id",
    });

    const setup = await loginMethodsService.getLoginMethodSetup();

    expect(setup.missingCredentials.microsoft).toEqual(["MICROSOFT_CLIENT_SECRET"]);
    expect(JSON.stringify(setup)).not.toContain("existing-id");
  });

  it("locks the organization settings inside a transaction before checking an update", async () => {
    const { loginMethodsService, envRepository, tenantDbRunnerService } =
      createLoginMethodsService();

    await loginMethodsService.updateLoginMethod(
      { method: LOGIN_METHODS.PASSWORD, enabled: false },
      ACTOR,
    );

    expect(tenantDbRunnerService.transaction).toHaveBeenCalledTimes(1);
    expect(envRepository.findGlobalSettingsForUpdate).toHaveBeenCalledTimes(1);
  });

  it("saves both provider flags as internal secrets when enabling a configured provider", async () => {
    const { loginMethodsService, envService } = createLoginMethodsService({
      MICROSOFT_CLIENT_ID: "id",
      MICROSOFT_CLIENT_SECRET: "secret",
    });

    await loginMethodsService.updateLoginMethod(
      { method: LOGIN_METHODS.MICROSOFT, enabled: true },
      ACTOR,
    );

    expect(envService.bulkUpsertInternalEnv).toHaveBeenCalledWith(
      [
        { name: "MICROSOFT_OAUTH_ENABLED", value: "true" },
        { name: "VITE_MICROSOFT_OAUTH_ENABLED", value: "true" },
      ],
      ACTOR,
    );
  });

  it.each(REJECTED_UPDATES)(
    "rejects $title without saving anything",
    async ({ storedSecrets, enforceSSO, update, expectedError }) => {
      const { loginMethodsService, envService } = createLoginMethodsService(storedSecrets, {
        enforceSSO,
      });

      await expect(loginMethodsService.updateLoginMethod(update, ACTOR)).rejects.toThrow(
        expectedError,
      );
      expect(envService.bulkUpsertInternalEnv).not.toHaveBeenCalled();
    },
  );
});
